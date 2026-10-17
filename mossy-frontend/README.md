# React + TypeScript + Vite

## Appearance and Settings

`/settings` is public. Its System, Light, and Dark radios apply immediately and
save the browser preference as `mossy.theme`. System is the default. Login and
logout do not change the preference; other tabs receive updates through the
browser's storage event. If saving is blocked, the selected appearance remains
active for the visit and Settings shows an inline message.

`public/theme-init.js` must stay a synchronous classic script before the
stylesheet in `index.html`. It validates the stored value and sets the root
`data-theme` attribute before first paint. Keep its storage key and allowed
values aligned with `src/store/themeStore.ts`.

`src/globals.css` owns system detection, both palettes, native control color
schemes, and the 180 ms color transitions (disabled for reduced motion). Add
semantic tokens there instead of per-component `dark:` variants. Filled brand
and status colors remain constant; use `fg-brand`, `fg-success`, `fg-danger`,
and `fg-warning` for readable text, icons, and focus indicators. Programmatic
chart and animation colors should use CSS variables so existing views update
without remounting. QR codes intentionally retain green modules on white.

Settings and the footer link to `.github/ISSUE_TEMPLATE/feature_request.yml`.
Merge that template into the GitHub default branch (`main`) before releasing
the feature-request link.

Run `npm test`, `npm run lint`, and `npm run build` for automated checks. For
browser review, `npm run dev:mock` starts the app and local mock API; exercise
both device preferences, explicit overrides, live System changes, reloads,
cross-tab updates, denied storage, keyboard menus, and mobile layouts.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
    globalIgnores(['dist']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            // Other configs...

            // Remove tseslint.configs.recommended and replace with this
            tseslint.configs.recommendedTypeChecked,
            // Alternatively, use this for stricter rules
            tseslint.configs.strictTypeChecked,
            // Optionally, add this for stylistic rules
            tseslint.configs.stylisticTypeChecked,

            // Other configs...
        ],
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.node.json', './tsconfig.app.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            // other options...
        },
    },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';

export default defineConfig([
    globalIgnores(['dist']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            // Other configs...
            // Enable lint rules for React
            reactX.configs['recommended-typescript'],
            // Enable lint rules for React DOM
            reactDom.configs.recommended,
        ],
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.node.json', './tsconfig.app.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            // other options...
        },
    },
]);
```
