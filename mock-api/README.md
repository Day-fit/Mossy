# Mossy mock API

This package replaces the backend services consumed by `mossy-frontend` with one local, JSON-seeded process. Runtime changes are kept in memory and reset whenever the API restarts.

## Start the frontend and mock API

With Node.js 22 installed, run from the repository root:

```sh
npm --prefix mock-api install
npm --prefix mossy-frontend install
npm --prefix mossy-frontend run dev:mock
```

The command starts the API on `http://localhost:3001` and Vite in `mock` mode. Vite proxies all `/api` HTTP and SockJS traffic to the mock.

To run only the API:

```sh
npm --prefix mock-api run dev
```

Use another scenario by setting `MOCK_SCENARIO`:

```sh
MOCK_SCENARIO=empty npm --prefix mossy-frontend run dev:mock
```

`PORT` changes the API port, but the Vite proxy defaults to port 3001.

## Default account

- Identifier: `demo` or `demo@mossy.test`
- Password: `Mossy123!`

A clean browser has no device identity matching the seeded account. On the first login, the default scenario creates and automatically approves the enrollment; the UI still shows the production-compatible pending message. Submit the same credentials a second time to complete the signed device login.

The `pending-enrollment` scenario disables automatic approval so the real approval state can be exercised.

## Scenarios

- `default` — populated account with online/offline vaults, metadata, tags, notes, devices, and statistics.
- `empty` — usable account without domain data.
- `offline-vault` — vault writes and reads that require connectivity return 503.
- `pending-enrollment` — newly confirmed devices remain pending until an authenticated device approves them.
- `dashboard-error` — dashboard statistics returns a delayed 503 through an operation override.

Each scenario owns `state.json` and `settings.json`. `settings.json` supports per-operation overrides:

```json
{
  "autoApproveEnrollments": true,
  "newVaultsOnline": true,
  "overrides": {
    "statistics.dashboard": {
      "status": 503,
      "delayMs": 750,
      "headers": { "X-Mock-Scenario": "example" },
      "body": { "message": "Statistics service is not available" }
    }
  }
}
```

Overrides run after request validation and authentication, but before state mutation.

## Maintaining contracts and data

- `contracts/routes.json` declares method, path, authentication mode, request schemas, and response schemas for every frontend operation.
- `contracts/schemas.json` contains strict JSON Schemas for HTTP DTOs, SockJS frames, scenario state, and settings.
- `scenarios/*/*.json` contains data and behavior switches.

The server refuses to start when contracts, fixtures, relationships, or override responses are invalid. It also validates every request and generated success response at runtime. Unknown request-body fields are rejected intentionally.

Routine path, DTO, fixture, and failure-scenario maintenance should only require JSON changes. A new domain algorithm or protocol behavior still requires a TypeScript operation handler registered under the route's operation ID.

## Key sync

The mock hosts SockJS at `/api/v1/ws/key-sync` and uses the production room protocol. It pairs two authenticated browser contexts, exchanges their signed peer details, waits for both `SIGNATURE_STATUS` messages, and relays the opaque `KEY_SYNC` message. It never receives plaintext keys or mock private keys.

To exercise the complete flow:

1. Sign the same account into two separate browser profiles, completing the two-login enrollment flow in each.
2. Create a vault in the source profile so that profile owns its local encryption key.
3. Open that vault in the receiver profile and start key synchronization.
4. Enter the generated six-digit code in the source profile's key-sync page.

## Verification

```sh
npm --prefix mock-api run typecheck
npm --prefix mock-api test
npm --prefix mock-api run build
npm --prefix mossy-frontend test
npm --prefix mossy-frontend run build
```
