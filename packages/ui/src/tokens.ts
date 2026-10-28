export const globalStyleTokens = {
    brand: '--color-brand',
    fgBrand: '--color-fg-brand',
    border: '--color-border',
    borderStrong: '--color-border-strong',
    fgPrimary: '--color-fg-primary',
    fgSecondary: '--color-fg-secondary',
    fgMuted: '--color-fg-muted',
    surface: '--color-surface',
    qrSurface: '--color-qr-surface',
    shadowCard: '--shadow-card',
} as const;

export type GlobalStyleToken = keyof typeof globalStyleTokens;

export function globalStyleVar(token: GlobalStyleToken): string {
    return `var(${globalStyleTokens[token]})`;
}

export function resolveGlobalStyleToken(token: GlobalStyleToken): string {
    const value = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(globalStyleTokens[token])
        .trim();

    if (!value) {
        throw new Error(
            `Global style token ${globalStyleTokens[token]} is missing`
        );
    }

    return value;
}
