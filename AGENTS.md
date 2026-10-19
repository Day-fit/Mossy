# Mossy extension v2 rebuild

This branch starts at `3e4c438753c444502193840446286d5613509de9` on
`feat/vault-pin-replacement`. Do not replace its PRF/vault-password implementation
with code from main.

## Legacy exclusion

The previous `mossy-extension` directory was deliberately deleted before this
implementation. Never inspect or recover its contents from Git history, other
branches/checkouts, generated bundles, package caches, or installed extensions.
The new directory is a fresh implementation. Use current frontend code and backend
contracts as the reference. Do not migrate legacy extension storage.

## Required behavior

- Follow `docs/extension-v2.md` for the accepted implementation specification.
- Every vault-secret operation requires fresh authorization. Metadata requires no
  vault unlock. Never introduce an unlocked session or reusable decrypted-key cache
  in the extension.
- Share frontend security algorithms and wire formats through platform adapters.
  Preserve the web frontend's existing unlock policy.
- Pending captured passwords are encrypted before showing any prompt. They expire
  ten seconds after capture, including time spent authorizing a save.
- Use the `design-taste-frontend` skill contextually and reuse the frontend's tokens,
  fonts, icon family, controls, themes, and restrained motion.
- Never log secrets or place decrypted credentials/keys in persisted state.
- Run meaningful shared crypto/boundary tests, frontend regressions, extension
  browser tests, affected backend tests, type checks, lint, and production builds.

The initial checkout's frontend baseline was 157 passing tests, a successful build,
and lint with zero errors and two existing hook-dependency warnings.
