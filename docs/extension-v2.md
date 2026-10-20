# Mossy extension v2

## Source and delivery

`main` is authoritative for vault protection and key-sync behavior. Keep the
PRF flow identical to `main`; changing that flow requires explicit user approval.
Preserve PRF-related source paths as edits, and identify actual extractions into
shared packages as moves. Git history is not rewritten.

Implement shared extraction, isolated extension authentication, PRF/password and
key-sync flows, autofill, capture/save, then release checks. Deliver an unpacked
extension and ZIP with installation instructions; do not publish to a browser store.

## Foundation

- Private npm workspaces: current frontend, new extension, shared client core, and
  shared UI. One root lockfile; update CI install/build/test commands.
- WXT/Vite, React, TypeScript, Zustand, Tailwind 4, framer-motion, Zod, idb, and
  libsodium aligned with the frontend dependencies. Chromium 137 minimum.
- Shared core contains the current frontend's auth/device enrollment, password
  payload serialization, PRF/password vault protection, AES encryption, and signed
  key-sync protocol. Preserve salt inputs, crypto parameters, transcript formats,
  ciphertext formats, and API DTOs.
- Platform interfaces cover transport, wrapped-key repository, device signer,
  protection provider, and account scope. Core has no React/Zustand dependencies
  or global unlocked-key cache. Frontend adapters retain existing behavior.
- Extension device private signing keys are native, non-extractable Ed25519
  CryptoKeys in IndexedDB. Wrapped vault keys are scoped by instance/account/vault.
  The extension enrolls as a new device and provisions keys through existing sync.

Shared extractions are implementation moves. Their original frontend entry points
remain as edited forwarding modules so existing imports keep working:

| Edited frontend entry point (`mossy-frontend/src/`) | Implementation moved to (`packages/`) |
| --- | --- |
| `key-sync/crypto.ts` | `client-core/src/keySync.ts` |
| `key-sync/receiverEvents.ts` | `client-core/src/receiverEvents.ts` |
| `api/sse.ts` | `client-core/src/sse.ts` |
| `ui/passwords/secretPayload.ts` | `client-core/src/secretPayload.ts` |
| `ui/shared/Button.tsx` | `ui/src/Button.tsx` |
| `theme/globalTokens.ts` | `ui/src/tokens.ts` |

## Authentication

Add POST `/api/v1/auth/extension/login`, `/refresh`, and `/logout`, backed by the
existing services and DTOs. The extension refresh cookie is distinct from the web
cookie, HttpOnly, production Secure, SameSite=Lax, and scoped to
`/api/v1/auth/extension`. Apply an explicit configured extension-origin allowlist;
never weaken global CORS. Token refresh/logout must coexist with the web session.
Access tokens stay in extension memory. Missing extension routes show an
upgrade-required error; never fall back to the web refresh cookie.

Default instance: `https://mossy.dayfit.pl`; allow one configurable HTTPS instance
per installation and localhost HTTP only in development. Resolve API requests
only against that instance. Registration stays in the web app. Existing device
approval/enrollment contracts remain authoritative.

The extension PRF adapter explicitly uses the configured Mossy hostname as RP ID,
with the frontend's per-vault PRF input (`mossy:encryption:v1:vault:${vaultId}`).
Request the necessary host permission. Store the credential ID with PRF-wrapped
keys and restrict unlock to that ID. Without a saved ID, verify the assertion's
user handle equals the vault ID. Never silently register/replace a passkey after
cancellation or treat an existing PRF-wrapped vault as password-wrapped.

Key sync uses main's signed v2 envelope and encrypted JSON payload containing
`rawKey` and nullable `credentialId`. Receive and verify/decrypt the transfer before
choosing local protection. Offer the same three explicit choices as main: use
this vault's existing passkey, set a vault password (with confirmation), or
register a new passkey for this vault. Display main's replacement warning before
registration. Registration uses the vault ID as the user handle and the vault
name as both credential labels. Cancellation stays retryable without creating a
credential or changing protection methods automatically.

## UI and contexts

Use the design-taste-frontend skill with existing Mossy branding: Syne/Geologica,
green accents, existing icon family and controls, semantic tokens, light/dark/system
themes, and restrained state transitions. Dials: DESIGN_VARIANCE=3,
MOTION_INTENSITY=3, VISUAL_DENSITY=5. Provide complete loading/empty/error states,
keyboard navigation, labels, contrast, and reduced-motion support.

- Toolbar popup: metadata browsing, vault selection, search, username/password
  copy actions, matching-site Fill, key-sync entry points, settings/sign-out, and
  pending save/update prompt with masked password and countdown.
- Trusted action window: fresh authorization for each secret operation, including
  stable native PRF ceremonies independently of toolbar-popup lifetime.
- One dedicated worker per secret action; terminate and clean up on every exit.
- Background: auth/device coordination, metadata, validated messaging, pending
  encrypted candidates, and API dispatch. No reusable decrypted vault keys.
- Minimal isolated content scripts: form discovery, capture on user submission,
  and one-shot filling of explicitly selected fields. No tokens/generic decrypt API.

Metadata remains available while protected. Every password copy, fill, save/update,
and vault-key transfer requires a fresh PRF or vault-password authorization.
Release keys immediately when that action completes, fails, or is canceled.
Unwrap ordinary-action keys as non-extractable; extraction is allowed only inside
an explicit key-sync send. Never persist vault/wrapping keys, vault passwords, or
decrypted credentials in Zustand/browser storage/logs/UI state.

For receiving key sync, keep only transport material during its bounded wait;
verify/decrypt the received key inside the action worker, then obtain the chosen
local protection and wrap the received key. Keep pending raw key material only
in that worker until protection succeeds or the action ends. Sending unlocks
just in time after verifying the receiver. No unlocked vault-key cache remains
afterward. Frontend vault caching policy is unchanged.

## Autofill and messaging

- User explicitly selects Fill and authorizes it. Never submit forms automatically.
- Match exact HTTPS origin. Legacy hostname-only entries match only that exact
  hostname on HTTPS/default port. Do not strip www or match sibling/subdomains.
- Bind actions to source tab/document/frame/origin/form and revalidate after
  authorization. Abort if the target changed. Only fill visible eligible fields.
- Top-level/same-origin frames only. Exclude HTTP, browser-internal pages,
  cross-origin frames, and Mossy's own auth/protection forms.
- Validate all IPC payloads and browser-supplied senders. Bind privileged commands
  to trusted packaged pages and one-shot action IDs. No arbitrary-fetch or generic
  decryption commands for content scripts. Restrict extension storage access to
  trusted contexts. Bundle scripts/fonts/WASM locally under a restrictive MV3 CSP.

## Capture and save/update

1. Ask for all-HTTPS host access during setup. Without access, metadata/copy remain
   usable and capture/fill are disabled. Detect supported user-initiated login and
   signup submissions; do not retain typed passwords between submissions.
2. Immediately encrypt transient capture input in the background handler with a
   distinct ephemeral AES-GCM key before establishing pending state or showing UI.
3. Set a hard deadline ten seconds from capture receipt. Open the toolbar popup
   programmatically. Show original site, identifier, destination vault, masked
   password, and remaining time. If opening fails, show a temporary badge without
   extending the deadline or forcing another window into focus.
4. New site/identifier offers Save; a matching record offers Update. Ambiguous
   matches require explicit selection. Suppress unchanged credentials just filled
   by Mossy. Check manually typed duplicate passwords only within the authorized
   update action and make identical updates a no-op.
5. Save/Update explicitly hands the candidate to the action window for fresh
   authorization; that handoff is not dismissal and never resets the deadline.
6. Only after authorization, consume the staged secret and serialize/encrypt with
   shared frontend code. Dispatch only before expiry. Release vault keys at once;
   an authorized dispatched HTTP request may complete after the deadline.
7. Delete candidate ciphertext and temporary keys on expiry, decline, dismissal,
   account change, source-tab closure, or loss of background state. Check deadlines
   at every boundary even if timers are delayed. Normal login redirects preserve
   the original captured site. Never retain a candidate for enrollment/key sync.
8. One candidate at a time: a new eligible submission destroys the old one. Never
   auto-save. Never queue secrets for offline retry.

## Validation and release

- Preserve the frontend tests on `main`; build and lint with no new issues.
- Real crypto compatibility frontend/extension in both sync directions, PRF and
  password wrapping, payload/ciphertext parsing, tampering, canceled passkeys,
  account isolation, and native/libsodium signer interoperability.
- Two consecutive secret actions cause two unlocks; metadata browsing causes none.
  Exercise cleanup and rejection of stale/forged messages on every exit path.
- Capture encryption before prompt, no plaintext in persistence/UI state, exact
  ten-second expiry including authorization, races, redirects, duplicates,
  handoff, background termination, and network failures.
- Playwright persistent Chromium context against the built MV3 extension, plus
  manual Chrome/Edge/Brave checks for native PRF and automatic toolbar popup.
- Web/extension cookies and device sessions remain independent through login,
  refresh, logout, concurrent refreshes, expired tokens, and blocked devices.
- CI tests frontend/core/UI/extension for shared and lockfile changes; run affected
  backend tests, type checks, lint, and production builds. Generate unpacked/ZIP
  artifacts with installation and instance/origin configuration documentation.

Out of scope: Firefox, full vault CRUD, SSH operations, offline secret caching,
legacy extension migrations, and browser-store publication.
