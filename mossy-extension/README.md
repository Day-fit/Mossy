# Mossy extension

WXT launchers live in `entrypoints/`. Application code lives in `src/`, grouped
by responsibility:

```text
entrypoints/       WXT background, content script, popup, and action launchers
src/
  Action.tsx       Top-level secure-action screen
  Popup.tsx        Top-level popup screen
  globals.css      Styles shared across the extension
  actions/         Secret worker, key-sync crypto, and event parsing
  background/      Device login, action lifecycle, command handling, browser events
  capture/         Login-form discovery and pending password captures
  password-generation/ Password generator and new-password field insertion
  messaging/       Typed RPC and sender-checked background registrations
  security/        Origin/sender validation and vault passkey ceremonies
  storage/         IndexedDB setup, device identity, wrapped keys, and settings
  theme/           Theme type and React subscription hook
  types/           Shared vault, entry, and action models
  ui/
    action/        Secure-action components and behavior hooks
    auth/          Sign-in screen
    fill/          Shared saved-login and generation suggestions
    popup/         Popup sections, state, and behavior hooks
    shared/        Components used across screens
tests/
  *.spec.ts        Browser scenarios grouped by feature
  fixtures/        Isolated browser profiles, API mocks, and vault setup
  helpers/         Shared browser interactions and key-sync setup
```

Keep unit tests beside the module they exercise. Keep screen-specific components
and hooks in their matching `ui` folder; keep top-level screens and global styles
in `src/`. Put a component in `ui/shared` when multiple screens use it. Browser
entrypoints should configure and launch the relevant module.

Endpoint functions are imported directly from `mossy-api-client`, including
`mossy-api-client/extension/auth.api` for extension authentication.

Secrets stay in transient input elements and action workers. Popup state holds
metadata only. Storage modules persist wrapped vault keys and native device
identity, preserving the existing database name and schema.

With website access enabled, focusing a username or password field offers saved
logins for that exact HTTP or HTTPS origin (including the scheme and port) from
online vaults. Arrow Down enters the suggestions, Enter selects a login, and
Escape dismisses them. Selecting a login
opens the existing authorization window before filling; it never submits the
form. Stored website addresses must include `http://` or `https://`; entries for a
different scheme, host, or port cannot fill the page. New-password fields offer
password generation instead of saved logins. Capture, fill, and generation share
form discovery and input updates; the generated value and its confirmation are
captured through the normal user submission flow.

`src/password-generation/generatePassword.ts` owns generation (24 Base58
characters using Nano ID). Generation fills eligible
`autocomplete="new-password"` fields in the same form, preserving current-password
fields and never submitting. GitHub's signup password field also supports
generation when it omits this autocomplete hint. The suggestions use an isolated
shadow root and the extension's shared globals stylesheet.

Background handlers check the browser-supplied sender before accepting popup or
action messages. Content messages validate their source, permission, and payload.
`ActionRegistry` owns action expiry, document claims, cancellation, and window
cleanup. Consuming an action releases its state while its result screen remains
open until the user closes it. RPC logging is explicitly disabled for secrets.

Action scopes identify `instance`, `accountId`, and `vaultId`. Vault names belong
to UI metadata in `ui/shared/useVaultStore.ts`; `useVaultName(scope)` fetches
metadata through the background and resolves the name by vault ID, falling back
to the ID when unavailable. Each extension page has its own Zustand store.

From the repository root:

```sh
npm run typecheck -w mossy-extension
npm run lint -w mossy-extension
npm run test -w mossy-extension
npm run build -w mossy-extension
npm run test:browser -w mossy-extension
```

Browser tests use the packaged extension, so build it before running them.
Playwright uses 50% of available CPU workers locally and in CI. Tests run
in parallel; each extension test gets its own browser profile and API state.
Screenshots and traces go into Playwright’s per-test output directory.

Styling uses Tailwind utilities and the same `@mossy/ui/tokens.css` theme, fonts,
and base styles as the frontend. `src/globals.css` imports that shared source
instead of copying frontend tokens or keeping unused frontend rules.

All extension components use Tailwind utilities. `src/globals.css` contains only
the shared theme import and the source declaration for shared UI components.
