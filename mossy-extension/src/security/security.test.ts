import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    assertLive,
    contentMessageSchema,
    matchesSite,
    validateInstance,
    contentSource,
    trustedPage,
} from './security';
import { PendingCapture } from '../capture/PendingCapture';
import { authorizePrf } from './passkeys';

afterEach(() => vi.unstubAllGlobals());

describe('exact origin and browser-supplied sender boundaries', () => {
    it.each([
        'https://site.example',
        'https://site.example/path',
        'site.example',
    ])('matches only the exact secure origin for %s', (address) => {
        expect(matchesSite(address, 'https://site.example/login')).toBe(true);

        for (const url of [
            'http://site.example',
            'https://www.site.example',
            'https://login.site.example',
            'https://site.example:8443',
            'https://site.example.evil.test',
        ]) {
            expect(matchesSite(address, url)).toBe(false);
        }
    });
    it('supports explicit nondefault origins without broadening legacy hostname entries', () => {
        expect(
            matchesSite(
                'https://site.example:8443/path',
                'https://site.example:8443'
            )
        ).toBe(true);
        expect(
            matchesSite('site.example:8443', 'https://site.example:8443')
        ).toBe(false);
        expect(
            matchesSite(
                'https://user:pass@site.example',
                'https://site.example'
            )
        ).toBe(false);
    });
    it('accepts one HTTPS instance and localhost HTTP only in development', () => {
        expect(() => validateInstance('https://vault.example')).not.toThrow();
        expect(() =>
            validateInstance('http://localhost:8080', true)
        ).not.toThrow();

        for (const value of [
            'https://vault.example/',
            'http://localhost',
            'http://vault.example',
            'https://user@vault.example',
            'https://vault.example/path',
            'https://vault.example?x=1',
            'https://vault.example/#hash',
        ]) {
            expect(() => validateInstance(value)).toThrow();
        }

        expect(() => validateInstance('http://vault.example', true)).toThrow();
    });
    it('rejects privileged commands in content messages', () => {
        expect(
            contentMessageSchema.safeParse({
                kind: 'action',
                operation: 'copy-password',
                vaultId: 'v',
            }).success
        ).toBe(false);
    });
    it('requires the packaged page plus browser sender identity; excludes cross-origin frames and Mossy forms', () => {
        vi.stubGlobal('chrome', {
            runtime: {
                id: 'extension-id',
                getURL: () => 'chrome-extension://extension-id/',
            },
        });

        expect(
            trustedPage(
                {
                    id: 'extension-id',
                    origin: 'chrome-extension://extension-id',
                    url: 'chrome-extension://extension-id/popup.html',
                },
                '/popup.html'
            )
        ).toBe(true);
        expect(
            trustedPage(
                {
                    id: 'evil',
                    origin: 'chrome-extension://extension-id',
                    url: 'chrome-extension://extension-id/popup.html',
                },
                '/popup.html'
            )
        ).toBe(false);

        const source = {
            id: 'extension-id',
            origin: 'https://site.example',
            url: 'https://site.example/login',
            documentId: 'doc',
            frameId: 0,
            tab: { id: 1, url: 'https://site.example/' },
        };

        expect(
            contentSource(
                source as chrome.runtime.MessageSender,
                'https://mossy.example'
            ).documentId
        ).toBe('doc');

        for (const changed of [
            { origin: 'https://evil.test' },
            { tab: { id: 1, url: 'https://other.example' } },
            { documentId: undefined },
            { url: 'http://site.example' },
        ]) {
            expect(() =>
                contentSource(
                    { ...source, ...changed } as chrome.runtime.MessageSender,
                    'https://mossy.example'
                )
            ).toThrow();
        }

        expect(() =>
            contentSource(
                source as chrome.runtime.MessageSender,
                'https://site.example'
            )
        ).toThrow();
    });
});

describe('ten-second encrypted candidate lifecycle', () => {
    const metadata = {
        origin: 'https://site.example',
        identifier: 'alice',
        tabId: 1,
        account: 'account',
    };
    it('encrypts before exposing metadata/prompt and never exposes plaintext/key through metadata', async () => {
        const prompts: unknown[] = [];
        const capture = new PendingCapture(() => {
            const value = capture.metadata();

            if (value) {
                prompts.push(value);
            }
        });

        await capture.stage('secret-at-capture', metadata);

        expect(prompts).toHaveLength(1);
        expect(JSON.stringify(prompts)).not.toContain('secret-at-capture');
        expect(Object.keys(capture.metadata()!)).not.toContain('key');
        expect(
            JSON.stringify(capture, (key, value) =>
                key === 'timer' ? undefined : value
            )
        ).not.toContain('secret-at-capture');
        capture.clear();
    });
    it('keeps the original receipt deadline through encryption and authorization handoff', async () => {
        let now = 1000;
        const capture = new PendingCapture(
            () => {},
            () => now
        );
        const staged = await capture.stage('secret', metadata, 500);

        expect(staged!.deadline).toBe(10500);
        now = 10499;
        capture.handoff(staged!.id, metadata.account);

        expect(capture.metadata()!.deadline).toBe(10500);
        now = 10500;

        await expect(
            capture.consume(staged!.id, metadata.account)
        ).rejects.toThrow();

        expect(capture.metadata()).toBeUndefined();
    });
    it('consumes at most once, checks account scope and clears on decline/background loss', async () => {
        const capture = new PendingCapture();
        const first = await capture.stage('secret', metadata);

        expect(() => capture.handoff(first!.id, 'other-account')).toThrow();
        capture.handoff(first!.id, metadata.account);

        expect(await capture.consume(first!.id, metadata.account)).toBe(
            'secret'
        );

        await expect(
            capture.consume(first!.id, metadata.account)
        ).rejects.toThrow();

        const second = await capture.stage('second', metadata);
        capture.handoff(second!.id, metadata.account);
        capture.clear();

        await expect(
            capture.consume(second!.id, metadata.account)
        ).rejects.toThrow();

        expect(new PendingCapture().metadata()).toBeUndefined();
    });
    it('replaces prior candidates, never queues them, and refuses deadlines delayed before staging', async () => {
        let now = 100;
        const capture = new PendingCapture(
            () => {},
            () => now
        );
        const first = await capture.stage('first', metadata);
        const second = await capture.stage('second', metadata);

        expect(() => capture.handoff(first!.id, metadata.account)).toThrow();
        capture.handoff(second!.id, metadata.account);

        expect(await capture.consume(second!.id, metadata.account)).toBe(
            'second'
        );
        now = 20000;

        expect(await capture.stage('expired', metadata, 1)).toBeUndefined();
        expect(capture.metadata()).toBeUndefined();
    });
    it('rejects the exact deadline even when timers are delayed', () => {
        expect(() => assertLive(10000, 9999)).not.toThrow();
        expect(() => assertLive(10000, 10000)).toThrow();
        expect(() => assertLive(10000, 10001)).toThrow();
    });
});

describe('native PRF cancellation', () => {
    it('requests the configured RP and vault salt and never creates/replaces after cancellation', async () => {
        const get = vi
            .fn()
            .mockRejectedValue(new DOMException('Canceled', 'NotAllowedError'));
        const create = vi.fn();
        vi.stubGlobal('navigator', { credentials: { get, create } });
        vi.stubGlobal('PublicKeyCredential', class {});

        await expect(
            authorizePrf('https://vault.example', 'vault')
        ).rejects.toMatchObject({ name: 'NotAllowedError' });

        expect(create).not.toHaveBeenCalled();

        const request = get.mock.calls[0]![0];

        expect(request.publicKey.rpId).toBe('vault.example');
        expect(
            new TextDecoder().decode(
                request.publicKey.extensions.prf.eval.first
            )
        ).toBe('mossy:encryption:v1:vault:vault');
    });
});

describe('concurrent encrypted staging boundaries', () => {
    it('an older encryption completion or conditional clear cannot delete the newer candidate', async () => {
        const original = crypto.subtle.encrypt.bind(crypto.subtle);

        let release: () => void = () => {};

        let started: () => void = () => {};

        const entered = new Promise<void>((resolve) => {
            started = resolve;
        });
        const barrier = new Promise<void>((resolve) => {
            release = resolve;
        });
        let first = true;
        const spy = vi
            .spyOn(crypto.subtle, 'encrypt')
            .mockImplementation(
                async (...args: Parameters<SubtleCrypto['encrypt']>) => {
                    if (first) {
                        first = false;
                        started();

                        await barrier;
                    }

                    return original(...args);
                }
            );
        const capture = new PendingCapture();
        const metadata = {
            origin: 'https://site.example',
            identifier: 'alice',
            tabId: 1,
            account: 'account',
        };

        try {
            const older = capture.stage('older', metadata);

            await entered;

            const newer = await capture.stage('newer', metadata);
            release();

            expect(await older).toBeUndefined();
            capture.clearIf('stale-id');

            expect(capture.metadata()!.id).toBe(newer!.id);
            capture.handoff(newer!.id, metadata.account);

            expect(await capture.consume(newer!.id, metadata.account)).toBe(
                'newer'
            );
        } finally {
            release();
            capture.clear();
            spy.mockRestore();
        }
    });
});
