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

describe('global design token contract', () => {
    const globals = readFileSync(globalsPath, 'utf8');

    it('uses globals.css as the only global stylesheet entry point', () => {
        const index = readFileSync(indexPath, 'utf8');

        expect(index).toContain('src/globals.css');
        expect(index).not.toContain('src/style.css');
        expect(existsSync(join(srcRoot, 'style.css'))).toBe(false);
    });

    it.each([
        '--mossy-color-brand',
        '--mossy-color-surface-page',
        '--mossy-color-surface-card',
        '--mossy-color-fg-primary',
        '--mossy-color-border',
        '--mossy-color-focus',
        '--mossy-color-success',
        '--mossy-color-danger',
        '--mossy-color-warning',
        '--mossy-shadow-card',
    ])('defines %s', (token) => {
        expect(globals).toContain(`${token}:`);
    });

    it('keeps static colors and palette utilities out of component source', () => {
        const rawColor =
            /["'`](?:#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|lab|lch|color)\([^"'`]*\)|(?:white|black))["'`]/gi;
        const rawPaletteUtility = new RegExp(
            `(?:bg|text|border(?:-[trblxy])?|ring|outline|fill|stroke|decoration|placeholder:text)-(?:${paletteNames})(?:-\\d{2,3})?(?:/\\d+)?`,
            'g'
        );
        const frameworkShadow = /(?:drop-)?shadow-(?:sm|md|lg|xl|2xl)\b/g;
        const violations: string[] = [];

        for (const path of sourceFiles(srcRoot)) {
            const source = readFileSync(path, 'utf8');
            const matches = [
                ...(source.match(rawColor) ?? []),
                ...(source.match(rawPaletteUtility) ?? []),
                ...(source.match(frameworkShadow) ?? []),
            ];

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

    it.each([
        ['brand', 'on-brand'],
        ['brand', 'surface-card'],
        ['fg-primary', 'surface-page'],
        ['fg-secondary', 'surface-card'],
        ['fg-muted', 'surface-card'],
        ['success', 'on-brand'],
        ['success', 'success-subtle'],
        ['danger', 'on-brand'],
        ['danger', 'danger-subtle'],
        ['warning', 'on-brand'],
        ['warning', 'warning-subtle'],
    ])('%s and %s meet WCAG AA contrast', (foreground, background) => {
        const tokenValue = (name: string) => {
            const match = globals.match(
                new RegExp(`--mossy-color-${name}:\\s*(#[\\da-fA-F]{6});`)
            );

            expect(match, `Missing hex value for ${name}`).not.toBeNull();
            return match![1];
        };

        expect(
            contrastRatio(tokenValue(foreground), tokenValue(background))
        ).toBeGreaterThanOrEqual(4.5);
    });
});
