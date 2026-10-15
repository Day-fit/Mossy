# Web appearance screenshots

Captured from local previews. Signed-in screens use the mock API's `default`
scenario and `demo` account; public pages use guest sessions.
Desktop captures use a 1440 × 1000 viewport; mobile captures use 375 × 812.
Full-page captures extend below the viewport where needed.

| Page                | Light                                | Dark                                |
| ------------------- | ------------------------------------ | ----------------------------------- |
| Home                | [Screenshot](home-light.png)         | [Screenshot](home-dark.png)         |
| Illustration detail | [Screenshot](illustration-light.png) | [Screenshot](illustration-dark.png) |
| Dashboard           | [Screenshot](dashboard-light.png)    | [Screenshot](dashboard-dark.png)    |
| Passwords           | [Screenshot](passwords-light.png)    | [Screenshot](passwords-dark.png)    |
| Vaults              | [Screenshot](vaults-light.png)       | [Screenshot](vaults-dark.png)       |
| Devices             | [Screenshot](devices-light.png)      | [Screenshot](devices-dark.png)      |
| Settings            | [Screenshot](settings-light.png)     | [Screenshot](settings-dark.png)     |
| Sign in             | [Screenshot](login-light.png)        | [Screenshot](login-dark.png)        |
| Sign up             | [Screenshot](register-light.png)     | [Screenshot](register-dark.png)     |
| Email verification  | [Screenshot](verify-email-light.png) | [Screenshot](verify-email-dark.png) |

Additional states:

- [Account menu with keyboard focus](account-menu-dark.png)
- [Mobile Settings](settings-mobile-dark.png)
- [Mobile navigation](mobile-menu-dark.png)
- [Password entry](password-entry-dark.png)
- [PIN modal](pin-modal-dark.png)
- [QR modal, Dark](qr-modal-dark.png) and [Light](qr-modal-light.png)
- [Rename modal](rename-modal-dark.png)

The seeded events fall outside the dashboard's rolling 30-day chart window, so
the dashboard captures show its empty-history state. The populated chart and
tooltip were also checked in Chromium with representative test data. The QR
captures show a temporary local sync session that was closed after verification.

To review the same pages, run `npm --prefix mossy-frontend run dev:mock`, sign in
with the mock credentials documented in `mock-api/README.md`, and choose Light
or Dark in Settings. Scroll through Home to reveal its existing section
animations before taking a full-page capture.
