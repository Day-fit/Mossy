import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    assertLive,
    contentMessageSchema,
    validateInstance,
    contentSource,
    trustedPage,
} from './security';
import { matchesSite } from './website';
import { PendingCapture } from '../capture/PendingCapture';
import { authorizePrf } from './passkeys';
import { scopeKey } from './vaultCrypto';

afterEach(() => vi.unstubAllGlobals());

describe('wrapped-key storage scope', () => {
    it('preserves existing database keys after renaming scope fields', () => {
        expect(
            scopeKey({
                instance: 'https://mossy.test',
                accountId: 'account',
                vaultId: 'vault',
            })
        ).toBe('["https://mossy.test","account","vault"]');
    });
});

describe('exact origin and browser-supplied sender boundaries', () => {
    it.each(['http:', 'https:'])(
        'matches the exact %s origin including its port',
        (protocol) => {
            const address = `${protocol}//site.example:8443/path`;

            expect(
                matchesSite(address, `${protocol}//site.example:8443/login`)
            ).toBe(true);
            expect(
                matchesSite(
                    `${protocol}//site.example`,
                    `${protocol}//site.example/login`
                )
            ).toBe(true);

            for (const target of [
                `${protocol === 'http:' ? 'https:' : 'http:'}//site.example:8443`,
                `${protocol}//www.site.example:8443`,
                `${protocol}//login.site.example:8443`,
                `${protocol}//site.example`,
                `${protocol}//site.example.evil.test:8443`,
                `${protocol}//user:pass@site.example:8443`,
            ]) {
                expect(matchesSite(address, target)).toBe(false);
            }
        }
    );

    it.each([
        'site.example',
        'site.example:8443',
        'https:site.example',
        'http:site.example',
        'ssh://site.example',
        'ftp://site.example',
        'https://user:pass@site.example',
        '',
    ])('rejects unsupported or unprefixed stored addresses: %s', (address) => {
        expect(matchesSite(address, 'https://site.example')).toBe(false);
        expect(matchesSite(address, 'http://site.example')).toBe(false);
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

        expect(
            contentSource(
                {
                    ...source,
                    origin: 'http://site.example',
                    url: 'http://site.example/login',
                    tab: { ...source.tab, url: 'http://site.example/' },
                } as chrome.runtime.MessageSender,
                'https://mossy.example'
            ).origin
        ).toBe('http://site.example');

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

describe('thirty-second encrypted candidate lifecycle', () => {
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

        expect(staged!.deadline).toBe(30500);
        now = 30499;
        capture.handoff(staged!.id, metadata.account);

        expect(capture.metadata()!.deadline).toBe(30500);
        now = 30500;

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
        now = 40000;

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
