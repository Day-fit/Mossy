# Install and develop Mossy extension v2

The rebuilt extension supports desktop Chromium 137 and later, including current
Chrome, Edge, and Brave. It enrolls as its own Mossy device. Existing web vaults and
their ciphertext remain compatible; legacy extension state is not imported.

## Build from this branch

Use Node 22.12 or later and run npm commands from the repository root. The root
lockfile installs the frontend, extension, shared client core, and shared UI as
workspaces. Do not install the frontend with its retired per-app lockfile.

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run extension:zip
```

The unpacked extension is in `mossy-extension/.output/chrome-mv3/`. WXT writes the
versioned Chromium ZIP alongside it in `mossy-extension/.output/`. Pull-request CI
uploads both as the `mossy-extension-chromium` artifact after validation. The main
build also produces this artifact; neither workflow publishes to a browser store.

For local development, use `npm run dev --workspace mossy-extension`. Frontend
development remains available with `npm run dev --workspace mossy-frontend`.

The frontend Docker image still copies the already-built frontend `dist` directory.
Build the frontend through the root workspace before using its existing image
build; shared sources are bundled into those assets and need no runtime mount.

## Load the extension and configure the server

1. Open `chrome://extensions`, `edge://extensions`, or `brave://extensions` and
   enable Developer mode. Select **Load unpacked** and choose the
   `mossy-extension/.output/chrome-mv3/` directory. For a ZIP artifact, extract it
   into a stable directory first.
2. Copy the extension's ID from that management page. On `mossy-auth`,
   `mossy-device-trust`, `mossy-password`, and `mossy-key-sync`, set
   `MOSSY_EXTENSION_ORIGINS` to `chrome-extension://` followed by that exact ID,
   then restart/redeploy those services. Multiple approved builds can be
   comma-separated. Empty configuration disables extension login; wildcards and
   website origins are rejected. See [authentication configuration](authentication.md#browser-extension-sessions).
3. Open Mossy from the browser toolbar. The default instance is
   `https://mossy.dayfit.pl`. A self-hosted instance must use a single HTTPS origin,
   with the web app and API served through that origin. Grant access to the
   configured instance when requested. Localhost HTTP is for development only.
4. Sign in with your Mossy account. Approve the new device from an already trusted
   Mossy device, then sign in again. Account registration and email verification
   remain in the web app.
5. Receive the selected vault's key using the displayed sync code and a trusted
   device that already has that key. Protect the received key with your existing
   Mossy PRF passkey or a vault password of at least twelve characters. A canceled
   passkey prompt does not create or replace a passkey.
6. Enable HTTPS site access to use form discovery, autofill, and automatic save
   prompts. Without that grant, metadata browsing and copying remain available.

The checked-in public manifest key gives unpacked builds the stable ID
`amkfdcmiegnfjnaidcoaojapakdcchoj`. Its auth-service configuration is:

```dotenv
MOSSY_EXTENSION_ORIGINS=chrome-extension://amkfdcmiegnfjnaidcoaojapakdcchoj
```

Confirm the actual ID for differently signed or store-distributed builds. The
public manifest key is identification material, not a signing secret.

The web app and extension have separate device identities and refresh cookies.
Signing out of one does not sign out of the other. A server without the extension
auth routes must be upgraded; the extension never falls back to the web cookie.

## Everyday behavior

Metadata can be searched without unlocking a vault. Every password copy, fill,
save/update, and key transfer requests a fresh authorization. There is no unlocked
extension session or reusable decrypted-key cache. Authorizing one operation does
not authorize the next one.

Fill targets must match the exact HTTPS origin of the saved entry. The extension
fills the selected visible form after authorization and never submits it. Legacy
hostname-only entries match only that hostname on default-port HTTPS; `www`,
sibling domains, custom ports, cross-origin frames, and HTTP are not interchangeable.

A supported login/signup submission opens a save/update prompt with a ten-second
deadline. The candidate password is encrypted before the prompt appears. Selecting
Save/Update opens the authorization window, and its time counts toward the same
deadline. Timeout, decline, dismissal, tab closure, or sign-out discards the
candidate. A normal login redirect keeps the captured source site; it does not
reset the timer. No secret is queued for offline retry or retained for key sync.

## Browser and backend checks

```sh
npx playwright install --with-deps chromium
npm run test:browser
mvn -B -ntp -pl mossy-auth,mossy-device-trust,mossy-password,mossy-key-sync -am test
```

Browser tests use a fresh persistent Chromium profile, fixture accounts/API
responses, and the built extension, never an existing browser profile. Tests
that need website access seed a prior optional-host approval in that disposable
profile and exercise the badge fallback for unavailable native toolbar UI.
Before distributing a release, additionally
check native PRF prompts with a real authenticator in Chrome, Edge, and Brave,
including cancellation, an unsupported authenticator, and a second consecutive
operation requiring another authorization. Check system/light/dark themes,
keyboard navigation, automatic toolbar prompt opening, and timeout while the
native passkey prompt is open.

Firefox, vault management, SSH operations, offline secret caching, and browser-store
publication are outside this release.
