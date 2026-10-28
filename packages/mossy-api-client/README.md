# mossy-api-client

The existing Mossy API files, moved whole from the frontend and extension.
Endpoint functions call `apiFetch` directly. There are no transport classes,
platform interfaces, client factories, or compatibility forwarding modules.

```ts
import { executeUserVaultsRequest } from 'mossy-api-client/vault.api';
import { executeExtensionLogoutRequest } from 'mossy-api-client/extension/auth.api';

const webVaults = await executeUserVaultsRequest();
const extensionVaults = await executeUserVaultsRequest('https://mossy.dayfit.pl');
await executeExtensionLogoutRequest('https://mossy.dayfit.pl');
```

`src/api/` contains the original frontend `*.api.ts` files and their DTOs.
`src/extension/auth.api.ts` contains extension-only login, refresh, and logout.
Web auth and extension auth keep their respective endpoint paths.

Frontend implementations come from `origin/main` at
`3c6e3f33756b866771987e8757bc6f7d6f6d4cec`. Functions used by the extension accept
an optional trailing `instance` argument (default `''`, preserving relative web
URLs). Password operations also accept an optional abort signal. Request bodies,
validation, response parsing, errors, and vault normalization remain as on main.

`apiFetch`, `ApiError`, token storage, and SSE parsing are unchanged from main.
Token storage is in-memory and belongs to each JavaScript context. Each app owns
its auth flow, crypto, persistence, and UI.
