export const globalStyleTokens = {
    brand: '--color-brand',
    border: '--color-border',
    fgSecondary: '--color-fg-secondary',
    surface: '--color-surface',
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
