# Refactor extension message boundaries and action lifetimes

Reviewed the extension's entrypoints, background authentication and commands,
content capture, action workers, cryptography and passkeys, persistence, popup
and action screens, theme handling, styles, manifest, build configuration, and
unit/browser tests using the code-review-and-quality skill.

## Findings addressed

| Severity | Finding                                                                                                                                  | Change                                                                                                                               |
|----------|------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| Critical | Privileged background handlers accepted content-script messages without checking the sender. Existing security helpers were not applied. | Check packaged page and browser sender identity before dispatch; limit action commands to their claimed document and URL.            |
| Required | Capture and discovery trusted non-null sender fields and unvalidated payloads.                                                           | Apply the existing source policy, optional-host permission checks, payload limits, and matching document origins.                    |
| Required | Fill and update operations relied on popup filtering for login selection.                                                                | Check discovered form identity and exact site matching in the background; require an update to match the captured username and site. |
| Required | Expired actions stayed in the map, and failed window creation left action/capture state behind.                                          | Centralize action lifetime, timers, window rollback, one-time consumption, and cancellation in `ActionRegistry`.                     |
| Required | Closing or navigating a source tab and replacing a capture did not cancel the affected authorization windows.                            | Cancel affected actions and close their windows; preserve ordinary post-submit redirects for pending captures.                       |
| Required | Changing instances retained the old token and outstanding actions; logout did not clear pending action/capture state.                    | Clear transient state directly during normal logout and instance changes.                                                            |
| Required | Launch setup was repeated across five handlers, with missing entries/devices/codes reaching non-null assertions.                         | Share account/device/vault setup and window creation; return specific errors for missing selections.                                 |
| Required | A removed selected vault could keep the popup requesting stale metadata.                                                                 | Fall back to an available vault.                                                                                                     |
| Required | Secret parsing rejected an SSH payload without the optional public key.                                                                  | Match the declared payload shape and cover its round trip.                                                                           |
| Required | Browser tests still used removed command envelopes and expected successful action windows to auto-close.                                 | Exercise the current RPC and explicit Close flow; verify worker termination and real content-script privilege rejection.             |

## Additional improvements

- Separate popup, content, and action message types; keep shared form types out of the background module.
- Register authentication through the background initializer so it shares startup readiness and sender checks.
- Clear transient password/PRF inputs on worker failures and wipe temporary decrypted/DH byte buffers.
- Explicitly silence transport logging. The installed implementation currently leaves logging off when no logger is configured, despite its API documentation describing a console default.
- Preserve the IndexedDB schema, wrapped-key format, and cryptographic protocol.

## Scope decisions

The user explicitly excluded handling account or instance changes during
in-flight requests. Session-version guards, transition queues, and the
`SessionState` abstraction were removed. The preference is recorded in the
local, Git-excluded `AGENTS.md`.

## Verification

- 69 unit tests across 8 test files pass; the baseline was 40 tests.
- All 19 packaged Chromium browser tests pass.
- Type checking, ESLint, production WXT build, and `git diff --check` pass.
- Inverting the page-sender guard makes its regression test fail; the original guard was restored.
- `npm audit --omit=dev` reports zero known vulnerabilities; no dependencies or lockfiles were changed.
- An independent review found no remaining actionable regressions within the agreed scope.

Browser network calls use fixtures. Native passkey behavior is checked through
ceremony fixtures and cancellation tests, rather than a physical authenticator.

## Optional follow-up

- The existing `Command` type, legacy `contentMessageSchema`, storage `saveSettings` helper, and secure-action username-copy branch have no production callers. They were retained for a separate cleanup decision.
- The main logo is approximately 957 kB, and the popup updates its clock every 200 ms even without a pending capture. These are possible asset-size/rendering improvements; neither was needed for this refactor.
