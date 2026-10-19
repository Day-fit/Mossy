# Authentication and JWKS

Mossy uses OAuth2 resource-server support with JWTs signed by `mossy-auth`.
The legacy custom bearer-token filter and the standalone `mossy-jwks` service
are no longer part of the authentication design.

## Browser extension sessions

The rebuilt extension enrolls as a separate device and uses these routes:

- `POST /api/v1/auth/extension/login`: the existing login DTO and token response,
  including the existing enrollment-token flow for devices awaiting approval.
- `POST /api/v1/auth/extension/refresh`: rotates the extension refresh token.
- `POST /api/v1/auth/extension/logout`: revokes and clears only the extension
  session; a missing extension cookie is tolerated.

The extension cookie is named `mossyExtensionRefreshToken`, is host-only and
HttpOnly, and has `Path=/api/v1/auth/extension` and `SameSite=Lax`. It is Secure
in production; the existing development cookie setting allows localhost HTTP.
The web app continues to use its own `refreshToken` cookie. Extension routes
never accept the web cookie as a substitute. Token responses are `no-store`, and
access tokens are not persisted by the extension.

Extension session routes are disabled until their exact packaged origins are
configured. Copy the extension ID from the browser's extension management page,
then set `MOSSY_EXTENSION_ORIGINS` on `mossy-auth` (Compose forwards this variable):

```dotenv
MOSSY_EXTENSION_ORIGINS=chrome-extension://amkfdcmiegnfjnaidcoaojapakdcchoj
```

The checked-in public manifest key gives unpacked builds the ID above. Confirm
the actual ID for a differently signed or store-distributed build before adding
it. The public manifest key is identification material, not a signing secret.

Use comma-separated exact origins for multiple approved builds. The corresponding
Spring property is `mossy.auth.extension.allowed-origins`. Wildcards, website
origins, trailing paths, and malformed IDs are rejected at startup. An empty list
rejects every extension session request. Local development also needs the exact
unpacked extension ID; it does not enable all origins automatically.

Set the same `MOSSY_EXTENSION_ORIGINS` on `mossy-device-trust`, `mossy-password`,
and `mossy-key-sync` as well (Compose forwards it). The shared security starter
uses `mossy.security.extension-allowed-origins` and explicit per-service
`mossy.security.extension-allowed-paths` for their bearer-token API CORS rules.
Those requests omit cookies. The auth service enables only `/user/me` through
that policy; existing web login, refresh, and logout routes remain excluded.
Rebuild all four service images from this branch; their Dockerfiles install the
checked-in security starter before packaging, so these rules do not depend on a
separately published starter version.

The browser must send that allowed `Origin` on login, refresh, and logout.
These routes use a dedicated CORS policy and also check the actual POST origin,
so they remain protected even when browser host permissions bypass CORS.
The web/API CORS allowlist is unchanged. Deployments overriding
`mossy.security.public-routes-patterns` must include `/extension/login`,
`/extension/refresh`, and `/extension/logout`; their cookie and origin checks
provide authentication independently of an access-token bearer header.

If the backend lacks these routes, upgrade it rather than sharing the web app's
refresh cookie. Extension login and key sync use the existing device identity
and approval contracts, and blocked-device/disabled-account checks still apply
when refreshing an extension session.

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

## Email verification

Registration returns `deviceId` and nullable `verification` metadata containing
`verificationId`, `expiresAt`, and `resendAvailableAt`. With
`mossy.auth.require-email-verification=true` (the production default), newly
registered accounts remain disabled until confirmation. Login, enrollment-token
issuance, and refresh reject these accounts with `EMAIL_VERIFICATION_REQUIRED`.
The development profile keeps verification optional.

The public endpoints under `/api/v1/auth` are:

- `POST /user/confirm`: `{ "verificationId": "UUID", "code": "012345" }`,
  or the same request with `token` instead of `code`. Supply exactly one secret.
- `POST /user/verification/resend`: `{ "verificationId": "UUID" }`.
- `POST /user/verification/recover`: `{ "identifier": "username or email", "password": "password" }`.
  Recovery verifies credentials without creating a session.

Codes and links expire after 15 minutes. Each code belongs to its verification
ID; equal codes on different requests do not collide. Five failed code attempts
lock that code while leaving its email link usable. Resends replace the previous
request and require a 60-second cooldown, with five deliveries per account per
hour. Throttled responses include `Retry-After`. Expired or replaced requests
return 410. Redis retains request context for 24 hours to support resend and
idempotent confirmation; credentials are stored as hashes.

Registration stays in `UserService`; issuance, confirmation, resend, and recovery
share `EmailVerificationService`. Their explicit transaction blocks commit
account updates before email delivery and cache cleanup. Redis models
use repositories, with partial updates for attempt counters and completion so
concurrent reads never observe a temporarily deleted record. PostgreSQL user-row
locks serialize confirmation and resend.

The frontend `/verify-email` page supports code entry, resend, and credential
recovery. Email links carry their token in the URL fragment and require an
explicit Confirm click. Pending request metadata lives in session storage;
passwords and link tokens are not persisted there. Set `FRONTEND_BASE_URL` for
links in the Compose deployment.

Request rate limiting is configured in the `mossy-auth-verification` Traefik
router labels (10 requests per minute, burst 10). Backend limits apply to code
attempts and account deliveries.
