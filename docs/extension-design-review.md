# Extension design review

The extension follows the existing Mossy frontend, with compact layouts for a
400px popup and the separate 440px authorization window. The design-taste-frontend
review used DESIGN_VARIANCE=3, MOTION_INTENSITY=2, VISUAL_DENSITY=5: preserve the
brand, make controls predictable, and reserve motion for interaction feedback.

## Shared foundation

Both entrypoints import `mossy-extension/src/globals.css`. It imports the same
`@mossy/ui/tokens.css` as the frontend, including local Syne/Geologica fonts,
semantic colors, system/light/dark appearances, shadows, and focus treatment.
Buttons remain the actual `@mossy/ui` component used by the frontend. There is no
separate extension palette or duplicate theme definition. An explicit body font
in the extension globals overrides Chromium's injected extension stylesheet,
which otherwise replaces Syne with Noto Sans despite the shared token import.

The radius scale follows the frontend: 12px cards, 8px auth inputs and icon
surfaces, 6px controls. Spacing follows the frontend's 4px rhythm. Body copy is
14px; supplementary copy is 12px. No added imagery, external fonts, or libraries.

## Component audit

| Surface | Frontend reference | Change |
| --- | --- | --- |
| Header, settings, sign out | `Nav`, `AccountMenu`, shared icon buttons | Bordered surface header, consistent icon targets, accessible names and expanded states. |
| Sign in and enrollment feedback | `AuthForm`, `SigninForm` | Contained auth card, strong input borders, full-width primary action, separate registration link and security notice. |
| Instance, appearance, site permissions | Frontend auth fields and settings surfaces | Clear labels, distinct permission section, disabled permission control after access is granted. |
| Vault selection | `VaultSelectorCard` | Dedicated surface, vault total, green selected control; retain the compact native select. |
| Search | `SearchBar`, `PasswordListCard` | Shared green border and search icon; trimmed case-insensitive search and a visible no-results state. |
| Password entries and copy/fill actions | `PasswordListItemFrame`, `PasswordListItem` | Password-type icon, username/site hierarchy, secondary copy controls and primary fill; retain full origin visibility and explain disabled fill. |
| Empty vault or account | Frontend vault/password empty states | Clear next steps and a real link to create a vault. |
| Capture/save/update prompt | Frontend form and action surfaces | Outlined card with grouped metadata, masked password, expiration, update selection and primary authorization action. |
| Send/receive key controls | `KeySyncHero`, frontend input controls | Separated receive options and send form, consistent code field, keyboard focus moves to the expanded section. |
| Password/passkey authorization | `VaultAccessModal`, `ActionModal` | Contained card, method icon, explicit site/account context, password hint, adjacent cancel/authorize controls. |
| Waiting for key transfer | `KeySyncCodeGuide` | Readable receiving-code output with a distinct inset surface and waiting explanation. |
| Loading, error, completion | Frontend inline statuses and modal feedback | Shared loading shapes and icon/text statuses; initial load failures keep a retry action and cannot be dismissed into a blank popup. |
| Security notices | Frontend muted supporting text | Consistent icon and type treatment, outside primary task cards. |

The content script has no injected visual UI. The native toolbar badge and native
permission/authenticator dialogs keep their existing behavior. Secret handling,
per-action workers, transport, capture deadlines, and permission boundaries are
unchanged. Metadata refresh now visibly disables actions while loading and
ignores stale failed responses as well as stale successful responses.

## Verification

The packaged Chromium suite covers the existing security flows plus search
recovery, empty account/vault states, error retry, settings persistence, keyboard
focus, both explicit themes and system appearance, bundled font selection, and
long metadata in a scrollable list at 320px with no horizontal overflow.
Screenshots use fixture accounts and metadata, with empty authorization inputs.
They are stored in `docs/screenshots/extension-v2/`.

Native permission dialogs and real passkey prompts still use the manual browser
checks in `extension-installation.md`; headless automation does not validate those
OS/browser-owned surfaces. Lighthouse is not used for private extension pages;
the production package and real Chromium rendering are checked directly.

## Screenshots

| Surface | Light | Dark |
| --- | --- | --- |
| Passwords | [Light](screenshots/extension-v2/metadata-light.png) | [Dark](screenshots/extension-v2/metadata-dark.png) |
| Settings | [Light](screenshots/extension-v2/settings-light.png) | [Dark](screenshots/extension-v2/settings-dark.png) |
| Key sync | [Light](screenshots/extension-v2/sync-light.png) | [Dark](screenshots/extension-v2/sync-dark.png) |

Additional views: [sign in](screenshots/extension-v2/signed-out.png),
[password authorization](screenshots/extension-v2/action.png),
[capture prompt](screenshots/extension-v2/capture.png),
[save authorization](screenshots/extension-v2/save-action.png),
[receive protection](screenshots/extension-v2/receive-action.png),
[expired action](screenshots/extension-v2/action-error.png),
[empty search](screenshots/extension-v2/empty-dark.png), and
[320px long entries](screenshots/extension-v2/narrow.png).
