# Authentication and JWKS

Mossy uses OAuth2 resource-server support with JWTs signed by `mossy-auth`.
The legacy custom bearer-token filter and the standalone `mossy-jwks` service
are no longer part of the authentication design.

## Token contract

`mossy-auth` signs access and refresh tokens with RSA using `RS256`. Each token
includes a `kid` that identifies the public key used to validate it.

The signed `typ` header is `at+jwt` for access tokens (including enrollment and
internal tokens), and `JWT` for refresh tokens. There is no payload `type` claim.
Refresh tokens are recognized by their exclusive `MOSSY_AUTH_API` audience.
API decoders require `at+jwt` (or `application/at+jwt`) and accept only
`MOSSY_USER_API` and `MOSSY_INTERNAL_API` audiences. Both decoders verify the
signature, timestamps, and `mossy-auth` issuer.

Deploy the issuer and resource servers together. Existing access tokens without
`typ: at+jwt` are rejected, and existing refresh tokens need to be replaced by
signing in again.

By default, access tokens are valid for 15 minutes and refresh tokens for 14
days.

Consumers must use the standard JWT subject as the user identifier:

```text
sub = user UUID
```

Standard user access tokens contain these claims:

| Claim                | Meaning                                                             |
|----------------------|---------------------------------------------------------------------|
| `iss`                | `mossy-auth`                                                        |
| `aud`                | `MOSSY_USER_API`                                                    |
| `jti`                | Unique token identifier                                             |
| `iat`                | Token issue time                                                    |
| `exp`                | Token expiration time                                               |
| `roles`              | User roles, converted to Spring authorities with the `ROLE_` prefix |
| `preferred_username` | User's username                                                     |
| `email`              | User's email address                                                |
| `scope`              | `user.access` for standard user access tokens           |
| `device_id`          | Device associated with the access or refresh token                  |

Refresh tokens contain `iss`, `aud`, `sub`, `jti`, `iat`, `exp`, and
`device_id`; they do not carry access scopes or roles.

Do not rely on the retired `userId` claim. Controllers and services should
parse the user identifier from `Jwt.subject`.

The 30-second device-enrollment token does not contain `device_id`; it carries
the `device.enrollment.start` and `device.enrollment.challenge` scopes instead.
Internal service tokens use the `MOSSY_INTERNAL_API` audience and a
service-specific scope.

## JWKS publication and rotation

`mossy-auth` owns the JSON Web Key Set (JWKS) and exposes public signing keys
at:

```text
GET /api/v1/auth/.well-known/jwks.json
```

The endpoint is public so resource servers can obtain verification keys. The
private signing key stays in the auth process and is never written to the JWKS
file. Key rotation runs daily. Expired public keys are removed only when a new
key is persisted, and keys remain valid for the refresh-token lifetime plus one
day so tokens issued before rotation can still be validated.

Configure the auth service with a durable, writable JWKS path:

```properties
mossy.jwks.path=/app/data/jwks.json
```

All services, including `mossy-auth` for refresh-token decoding, must point
their resource-server decoder at the auth JWKS endpoint:

```properties
spring.security.oauth2.resourceserver.jwt.jwk-set-uri=${JWKS_PROVIDER_URI}
```

For the Docker Compose network, the expected value is:

```text
http://mossy-auth:8083/api/v1/auth/.well-known/jwks.json
```

## Resource-server starter

`mossy-oauth2-resource-server-starter` provides shared HTTP security support:

- CORS configuration from `mossy.security.allowed-origins`.
- A `JwtAuthenticationConverter` that reads the `scope` and `roles` claims and
  creates authorities such as `SCOPE_user.access` and `ROLE_USER`.

Each service remains responsible for its own `SecurityFilterChain`, public
route list (`mossy.security.public-routes-patterns`), and
`spring.security.oauth2.resourceserver.jwt.jwk-set-uri` setting.

## Docker Compose configuration

The root `compose.yaml` points each resource server at the `mossy-auth` JWKS
endpoint. It also mounts the named `jwks-data` volume at `/app/data`, allowing
the public key set to survive auth-container replacement. 
