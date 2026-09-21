export const globalStyleTokens = {
    brand: '--mossy-color-brand',
    brandHover: '--mossy-color-brand-hover',
    brandMuted: '--mossy-color-brand-muted',
    border: '--mossy-color-border',
    chartPrimary: '--mossy-color-chart-primary',
    qrBackground: '--mossy-color-qr-background',
    rippleDark: '--mossy-color-ripple-dark',
    rippleInverse: '--mossy-color-ripple-inverse',
    surfaceCard: '--mossy-color-surface-card',
    tagUnlabeled: '--mossy-color-tag-unlabeled',
    transparent: '--mossy-color-transparent',
    brandFocusShadow: '--mossy-shadow-brand-focus',
    cardShadow: '--mossy-shadow-card',
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
