import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBrowserStorage } from '../test/browserStorage.ts';
import {
    startThemePreferenceSync,
    THEME_STORAGE_KEY,
    useThemeStore,
} from './themeStore.ts';

const bootstrap = readFileSync(
    join(process.cwd(), 'public/theme-init.js'),
    'utf8'
);
const runBootstrap = () =>
    new Function('window', 'document', bootstrap)(window, document);
let stopSync: (() => void) | undefined;

beforeEach(() => {
    installBrowserStorage();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ preference: 'system', persistenceError: false });
});

afterEach(() => {
    stopSync?.();
    stopSync = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('theme bootstrap', () => {
    it.each(['system', 'light', 'dark'])(
        'restores %s before React starts',
        (saved) => {
            window.localStorage.setItem(THEME_STORAGE_KEY, saved);
            runBootstrap();
            expect(document.documentElement.dataset.theme).toBe(saved);
            stopSync = startThemePreferenceSync();
            expect(useThemeStore.getState().preference).toBe(saved);
        }
    );

    it.each([null, '', 'DARK', 'auto', 'undefined'])(
        'defaults %s to System without overwriting storage',
        (saved) => {
            if (saved !== null)
                window.localStorage.setItem(THEME_STORAGE_KEY, saved);
            const write = vi.spyOn(Storage.prototype, 'setItem');
            runBootstrap();
            expect(document.documentElement.dataset.theme).toBe('system');
            expect(write).not.toHaveBeenCalled();
        }
    );

    it('continues with System when storage reads are denied', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage denied', 'SecurityError');
        });
        expect(runBootstrap).not.toThrow();
        expect(document.documentElement.dataset.theme).toBe('system');
    });

    it('loads as a blocking classic script before the stylesheet and app', () => {
        const index = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
        const script = index.match(
            /<script\b[^>]*src="\/theme-init.js"[^>]*><\/script>/
        )?.[0];
        expect(script).toBeTruthy();
        expect(script).not.toMatch(/\b(?:async|defer|type)=?/);
        expect(index.indexOf(script!)).toBeLessThan(
            index.indexOf('src/globals.css')
        );
        expect(index.indexOf(script!)).toBeLessThan(
            index.indexOf('src/main.tsx')
        );
    });
});

describe('theme preference synchronization', () => {
    it('applies and saves a choice immediately', () => {
        stopSync = startThemePreferenceSync();
        useThemeStore.getState().setPreference('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(useThemeStore.getState().persistenceError).toBe(false);
    });

    it('retains a choice in memory when saving fails, then recovers on a successful save', () => {
        const write = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementationOnce(() => {
                throw new DOMException('Storage full', 'QuotaExceededError');
            });
        useThemeStore.getState().setPreference('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(useThemeStore.getState()).toMatchObject({
            preference: 'dark',
            persistenceError: true,
        });
        useThemeStore.getState().setPreference('light');
        expect(write).toHaveBeenCalledTimes(2);
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        expect(useThemeStore.getState().persistenceError).toBe(false);
    });

    it.each([
        [THEME_STORAGE_KEY, 'dark', 'dark'],
        [THEME_STORAGE_KEY, 'light', 'light'],
        [THEME_STORAGE_KEY, 'system', 'system'],
        [THEME_STORAGE_KEY, 'invalid', 'system'],
        [THEME_STORAGE_KEY, null, 'system'],
        [null, null, 'system'],
    ])(
        'syncs key %s value %s without writing it back',
        (key, newValue, expected) => {
            document.documentElement.dataset.theme = 'dark';
            stopSync = startThemePreferenceSync();
            const write = vi.spyOn(Storage.prototype, 'setItem');
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key,
                    newValue,
                    storageArea: window.localStorage,
                })
            );
            expect(document.documentElement.dataset.theme).toBe(expected);
            expect(useThemeStore.getState().preference).toBe(expected);
            expect(write).not.toHaveBeenCalled();
        }
    );

    it('ignores unrelated keys and session storage, and removes its listener on cleanup', () => {
        stopSync = startThemePreferenceSync();
        window.dispatchEvent(
            new StorageEvent('storage', { key: 'other', newValue: 'dark' })
        );
        window.dispatchEvent(
            new StorageEvent('storage', {
                key: THEME_STORAGE_KEY,
                newValue: 'dark',
                storageArea: window.sessionStorage,
            })
        );
        expect(useThemeStore.getState().preference).toBe('system');
        stopSync();
        window.dispatchEvent(
            new StorageEvent('storage', {
                key: THEME_STORAGE_KEY,
                newValue: 'dark',
            })
        );
        expect(useThemeStore.getState().preference).toBe('system');
    });
});
