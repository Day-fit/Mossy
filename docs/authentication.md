# Authentication and JWKS

Mossy uses OAuth2 resource-server support with JWTs signed by `mossy-auth`.
The legacy custom bearer-token filter and the standalone `mossy-jwks` service
are no longer part of the authentication design.

## Token contract

`mossy-auth` signs access and refresh tokens with RSA using `RS256`. Each token
includes a `kid` that identifies the public key used to validate it.

Consumers must use the standard JWT subject as the user identifier:

```text
sub = user UUID
```

The following claims are also issued:

| Claim | Meaning |
|---|---|
| `iss` | `mossy-auth` |
| `aud` | `mossy-user-api` |
| `roles` | User roles, converted to Spring authorities with the `ROLE_` prefix |
| `preferred_username` | User's username |
| `email` | User's email address |

Do not rely on the retired `userId` claim. Controllers and services should
parse the user identifier from `Jwt.subject`.

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
- A `JwtAuthenticationConverter` that reads the `roles` claim and creates
  authorities such as `ROLE_USER`.

Each service remains responsible for its own `SecurityFilterChain`, public
route list (`mossy.security.public-routes-patterns`), and
`spring.security.oauth2.resourceserver.jwt.jwk-set-uri` setting.

## Deployment migration note

The root `compose.yaml` still contains the retired `mossy-jwks` service and
configures `JWKS_PROVIDER_URI` to that service. Before deploying this branch,
update those values to point at `mossy-auth` as shown above and remove the
obsolete `JWKS_UPLOAD_URL` setting and standalone service.
