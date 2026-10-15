import { vi } from 'vitest';

/** Vitest 3 preserves Node 25+ storage globals instead of jsdom's browser storage. */
export function installBrowserStorage() {
    const { jsdom } = globalThis as typeof globalThis & {
        jsdom: { window: { localStorage: Storage; sessionStorage: Storage } };
    };
    vi.stubGlobal('localStorage', jsdom.window.localStorage);
    vi.stubGlobal('sessionStorage', jsdom.window.sessionStorage);
}
