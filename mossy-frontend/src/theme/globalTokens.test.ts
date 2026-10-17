import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const frontendRoot = process.cwd();
const srcRoot = join(frontendRoot, 'src');
const globalsPath = join(srcRoot, 'globals.css');
const indexPath = join(frontendRoot, 'index.html');

const paletteNames = [
    'white',
    'black',
    'gray',
    'zinc',
    'slate',
    'neutral',
    'stone',
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
].join('|');

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) return sourceFiles(path);
        if (!['.ts', '.tsx', '.css'].includes(extname(entry.name))) return [];
        if (entry.name.includes('.test.')) return [];
        if (path === globalsPath) return [];

        return [path];
    });
}

function hexToLuminance(hex: string): number {
    const channels = hex
        .slice(1)
        .match(/.{2}/g)!
        .map((value) => Number.parseInt(value, 16) / 255)
        .map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        );

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
    const firstLuminance = hexToLuminance(first);
    const secondLuminance = hexToLuminance(second);

    return (
        (Math.max(firstLuminance, secondLuminance) + 0.05) /
        (Math.min(firstLuminance, secondLuminance) + 0.05)
    );
}

function declarations(block: string): Record<string, string> {
    return Object.fromEntries(
        [...block.matchAll(/^\s*(--[\w-]+):\s*(.+);/gm)].map(
            ([, name, value]) => [name, value]
        )
    );
}

function color(tokens: Record<string, string>, name: string): string {
    const value = tokens[`--color-${name}`];
    const alias = value?.match(/^var\(--color-([\w-]+)\)$/);
    if (alias) return color(tokens, alias[1]);
    expect(value, `Missing hex color for ${name}`).toMatch(/^#[\da-f]{6}$/i);
    return value;
}

function blend(
    foreground: string,
    background: string,
    opacity: number
): string {
    const channels = (hex: string) =>
        hex
            .slice(1)
            .match(/.{2}/g)!
            .map((value) => Number.parseInt(value, 16));
    const back = channels(background);
    return (
        '#' +
        channels(foreground)
            .map((channel, index) =>
                Math.round(channel * opacity + back[index] * (1 - opacity))
                    .toString(16)
                    .padStart(2, '0')
            )
            .join('')
    );
}

describe('global design token contract', () => {
    const globals = readFileSync(globalsPath, 'utf8');
    const base = declarations(globals.match(/@theme static\s*\{([^}]+)\}/)![1]);
    const dark = declarations(
        globals.match(/:root\[data-theme='dark'\]\s*\{([^}]+)\}/)![1]
    );
    const themes = [
        ['light', base],
        ['dark', { ...base, ...dark }],
    ] as const;

    it('uses globals.css as the only global stylesheet entry point', () => {
        const index = readFileSync(indexPath, 'utf8');

        expect(index).toContain('src/globals.css');
        expect(index).not.toContain('src/style.css');
        expect(existsSync(join(srcRoot, 'style.css'))).toBe(false);
    });

    it('defines only the approved global theme tokens', () => {
        const declaredTokens = Object.keys(base);

        expect(declaredTokens).toEqual([
            '--font-sans',
            '--font-heading',
            '--color-brand',
            '--color-brand-hover',
            '--color-qr-surface',
            '--color-surface-page',
            '--color-surface',
            '--color-surface-subtle',
            '--color-surface-muted',
            '--color-fg-primary',
            '--color-fg-secondary',
            '--color-fg-muted',
            '--color-fg-subtle',
            '--color-fg-disabled',
            '--color-fg-inverse',
            '--color-fg-on-strong',
            '--color-fg-brand',
            '--color-fg-brand-hover',
            '--color-fg-success',
            '--color-fg-danger',
            '--color-fg-warning',
            '--color-border',
            '--color-border-strong',
            '--color-success',
            '--color-danger',
            '--color-danger-hover',
            '--color-warning',
            '--color-overlay',
            '--shadow-control',
            '--shadow-card',
            '--shadow-modal',
        ]);

        expect(globals).not.toContain('--mossy-');
        expect(globals).not.toMatch(/^\s*\.type-[\w-]+/m);
        expect(Object.keys(dark).every((name) => name in base)).toBe(true);
    });

    it('uses identical dark overrides for explicit Dark and the system media query', () => {
        const system = declarations(
            globals.match(
                /:root:not\(\[data-theme='light'\]\):not\(\[data-theme='dark'\]\)\s*\{([^}]+)\}/
            )![1]
        );
        expect(system).toEqual(dark);
        expect(globals).toContain('@media (prefers-color-scheme: dark)');
        expect(globals).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('keeps filled accents, inverse text, and QR colors constant', () => {
        for (const name of [
            'brand',
            'brand-hover',
            'success',
            'danger',
            'danger-hover',
            'warning',
            'fg-inverse',
            'qr-surface',
        ]) {
            expect(dark).not.toHaveProperty(`--color-${name}`);
        }
        expect(color(base, 'brand')).toBe('#007735');
        expect(color(base, 'qr-surface')).toBe('#ffffff');
    });

    it('keeps static colors and palette utilities out of component source', () => {
        const rawColor =
            /["'`](?:#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|lab|lch|color)\([^"'`]*\)|(?:white|black))["'`]/gi;
        const rawPaletteUtility = new RegExp(
            `(?:bg|text|border(?:-[trblxy])?|ring|outline|fill|stroke|decoration|placeholder:text)-(?:${paletteNames})(?:-\\d{2,3})?(?:/\\d+)?`,
            'g'
        );
        const frameworkShadow = /(?:drop-)?shadow-(?:sm|md|lg|xl|2xl)\b/g;
        const filledColorAsText =
            /\btext-(?:brand(?:-hover)?|success|danger|warning)\b/g;
        const violations: string[] = [];

        for (const path of sourceFiles(srcRoot)) {
            const source = readFileSync(path, 'utf8');
            const matches = [
                ...(source.match(rawColor) ?? []),
                ...(source.match(rawPaletteUtility) ?? []),
                ...(source.match(frameworkShadow) ?? []),
                ...(source.match(filledColorAsText) ?? []),
                ...(source.match(/\bdark:/g) ?? []),
            ];

            if (matches.length > 0) {
                violations.push(
                    `${path.slice(frontendRoot.length + 1)}: ${matches.join(', ')}`
                );
            }
        }

        expect(violations).toEqual([]);
    });

    it('keeps legacy tokens and global typography classes out of source', () => {
        const violations: string[] = [];

        for (const path of sourceFiles(srcRoot)) {
            const source = readFileSync(path, 'utf8');
            const matches = source.match(/--mossy-[\w-]+|\btype-[\w-]+/g) ?? [];

            if (matches.length > 0) {
                violations.push(
                    `${path.slice(frontendRoot.length + 1)}: ${matches.join(', ')}`
                );
            }
        }

        expect(violations).toEqual([]);
    });

    it('keeps animations in Framer Motion rather than CSS utilities', () => {
        const cssAnimationUtility =
            /(?:^|[\s"'`])(?:animate-[\w[\]-]+|transition(?:-[\w-]+)?|duration-\d+|active:scale-[^\s"'`]+)(?=$|[\s"'`])/gm;
        const violations: string[] = [];

        for (const path of sourceFiles(srcRoot).filter(
            (path) => extname(path) !== '.css'
        )) {
            const source = readFileSync(path, 'utf8');
            const matches = source.match(cssAnimationUtility) ?? [];

            if (matches.length > 0) {
                violations.push(
                    `${path.slice(frontendRoot.length + 1)}: ${matches.join(', ')}`
                );
            }
        }

        expect(globals).not.toContain('@keyframes');
        expect(violations).toEqual([]);
    });

    describe.each(themes)('%s palette', (_theme, tokens) => {
        it.each(['surface-page', 'surface', 'surface-subtle', 'surface-muted'])(
            'keeps body text and control boundaries legible on %s',
            (background) => {
                for (const foreground of [
                    'fg-primary',
                    'fg-secondary',
                    'fg-muted',
                    'fg-brand',
                    'fg-brand-hover',
                    'fg-success',
                    'fg-danger',
                ]) {
                    expect(
                        contrastRatio(
                            color(tokens, foreground),
                            color(tokens, background)
                        ),
                        foreground
                    ).toBeGreaterThanOrEqual(4.5);
                }
                expect(
                    contrastRatio(
                        color(tokens, 'border-strong'),
                        color(tokens, background)
                    )
                ).toBeGreaterThanOrEqual(3);
            }
        );

        it.each([
            'brand',
            'brand-hover',
            'success',
            'danger',
            'danger-hover',
            'warning',
        ])('keeps inverse text readable on filled %s', (background) => {
            expect(
                contrastRatio(
                    color(tokens, 'fg-inverse'),
                    color(tokens, background)
                )
            ).toBeGreaterThanOrEqual(4.5);
        });

        it.each(['brand', 'success', 'danger', 'warning'])(
            'keeps %s text legible on its tinted surface',
            (name) => {
                const background = blend(
                    color(tokens, name),
                    color(tokens, 'surface'),
                    0.05
                );
                expect(
                    contrastRatio(color(tokens, `fg-${name}`), background)
                ).toBeGreaterThanOrEqual(4.5);
            }
        );

        it('keeps bright foreground fills and QR modules readable', () => {
            expect(
                contrastRatio(
                    color(tokens, 'fg-on-strong'),
                    color(tokens, 'fg-primary')
                )
            ).toBeGreaterThanOrEqual(4.5);
            expect(
                contrastRatio(
                    color(tokens, 'brand'),
                    color(tokens, 'qr-surface')
                )
            ).toBeGreaterThanOrEqual(4.5);
        });
    });
});
