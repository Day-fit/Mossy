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
  auth/            Device login and enrollment flow
  background/      Background session, command handling, and browser events
  capture/         Login-form discovery and pending password captures
  messaging/       Popup RPC and action-window connections
  security/        Origin/sender validation and vault passkey ceremonies
  storage/         IndexedDB setup, device identity, wrapped keys, and settings
  theme/           Theme type and React subscription hook
  types/           Shared vault, entry, and action models
  ui/
    action/        Secure-action components and behavior hooks
    auth/          Sign-in screen
    popup/         Popup sections, state, and behavior hooks
    shared/        Components used across screens
tests/             Packaged-extension browser tests
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

From the repository root:

```sh
npm run typecheck -w mossy-extension
npm run lint -w mossy-extension
npm run test -w mossy-extension
npm run build -w mossy-extension
npm run test:browser -w mossy-extension
```

Browser tests use the packaged extension, so build it before running them.
