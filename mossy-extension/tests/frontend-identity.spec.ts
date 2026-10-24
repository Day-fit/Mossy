import { test, expect } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { resolve } from 'node:path';
import sodium from 'libsodium-wrappers-sumo';

let server: ViteDevServer;
let origin: string;
test.use({
    launchOptions: {
        executablePath: process.env.CHROMIUM_PATH,
        args: ['--no-sandbox'],
    },
});

test.beforeAll(async () => {
    await sodium.ready;
    server = await createServer({
        configFile: false,
        root: resolve('../mossy-frontend'),
        cacheDir: '/tmp/mossy-identity-browser-vite',
        optimizeDeps: {
            noDiscovery: true,
            include: ['idb', 'libsodium-wrappers-sumo'],
        },
        server: { host: '127.0.0.1', port: 0 },
    });
    server.middlewares.use('/identity-test', (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(
            '<!doctype html><html lang="en"><body>Identity migration fixture</body></html>'
        );
    });
    await server.listen();
    origin = server.resolvedUrls!.local[0]!;
});
test.afterAll(async () => {
    await server?.close();
});

function legacyIdentity() {
    const pair = sodium.crypto_sign_keypair();
    const encode = (bytes: Uint8Array) =>
        sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
    return {
        identity: {
            type: 'Ed25519',
            public: encode(pair.publicKey),
            private: encode(pair.privateKey),
        },
        nonce: encode(new Uint8Array(32).fill(17)),
        signature: encode(
            sodium.crypto_sign_detached(
                new Uint8Array(32).fill(17),
                pair.privateKey
            )
        ),
    };
}

test('frontend identity migration survives a real IndexedDB round trip without rotating the trusted key', async ({
    page,
}) => {
    const fixture = legacyIdentity();
    await page.goto(`${origin}identity-test`);
    const first = await page.evaluate(async ({ identity, nonce }) => {
        const modulePath = '/src/auth/deviceIdentity.ts';
        const api: typeof import('../../mossy-frontend/src/auth/deviceIdentity') =
            await import(modulePath);
        const db = await api.getDeviceDatabase();
        await db.put('keys', identity, 'current-device');
        await db.put('keys', identity, 'legacy-user');
        await db.put(
            'keys',
            {
                wrappedKey: new Uint8Array(40).fill(23).buffer,
                salt: new Uint8Array(16).fill(7),
            },
            'vault'
        );
        await api.storeDeviceId('trusted-device', 'alice');
        const native = await api.ensureDeviceIdentity();
        const exportRejected = await crypto.subtle
            .exportKey('pkcs8', native.privateKey)
            .then(
                () => false,
                () => true
            );
        return {
            public: native.public,
            signature: await api.signNonce(nonce, native),
            exportRejected,
        };
    }, fixture);
    expect(first).toEqual({
        public: fixture.identity.public,
        signature: fixture.signature,
        exportRejected: true,
    });
    await page.reload();
    const reloaded = await page.evaluate(async (nonce) => {
        const modulePath = '/src/auth/deviceIdentity.ts';
        const api: typeof import('../../mossy-frontend/src/auth/deviceIdentity') =
            await import(modulePath);
        const native = await api.ensureDeviceIdentity();
        const db = await api.getDeviceDatabase();
        const records = await db.getAll('keys');
        const vault = await db.get('keys', 'vault');
        return {
            public: native.public,
            signature: await api.signNonce(nonce, native),
            deviceId: await api.loadStoredDeviceId('alice'),
            rawCopies: records.filter(
                (record) => record?.type === 'Ed25519' && 'private' in record
            ).length,
            nativeCopies: records.filter(
                (record) =>
                    record?.type === 'Ed25519' &&
                    record.privateKey instanceof CryptoKey &&
                    !record.privateKey.extractable
            ).length,
            vaultKey: [...new Uint8Array(vault.wrappedKey)],
            salt: [...vault.salt],
            exportRejected: await crypto.subtle
                .exportKey('jwk', native.privateKey)
                .then(
                    () => false,
                    () => true
                ),
        };
    }, fixture.nonce);
    expect(reloaded).toEqual({
        public: fixture.identity.public,
        signature: fixture.signature,
        deviceId: 'trusted-device',
        rawCopies: 0,
        nativeCopies: 2,
        vaultKey: Array(40).fill(23),
        salt: Array(16).fill(7),
        exportRejected: true,
    });
});

test('new frontend identities are generated non-exportable and retain the same key across reloads', async ({
    page,
}) => {
    await page.goto(`${origin}identity-test`);
    const first = await page.evaluate(async () => {
        const modulePath = '/src/auth/deviceIdentity.ts';
        const api: typeof import('../../mossy-frontend/src/auth/deviceIdentity') =
            await import(modulePath);
        const identity = await api.ensureDeviceIdentity();
        return {
            public: identity.public,
            extractable: identity.privateKey.extractable,
            hasRawPrivateKey: 'private' in identity,
        };
    });
    expect(first.extractable).toBe(false);
    expect(first.hasRawPrivateKey).toBe(false);
    await page.reload();
    const publicKey = await page.evaluate(async () => {
        const modulePath = '/src/auth/deviceIdentity.ts';
        const api: typeof import('../../mossy-frontend/src/auth/deviceIdentity') =
            await import(modulePath);
        return (await api.ensureDeviceIdentity()).public;
    });
    expect(publicKey).toBe(first.public);
});

test('an aborted identity migration transaction preserves every original private-key record', async ({
    page,
}) => {
    const fixture = legacyIdentity();
    await page.goto(`${origin}identity-test`);
    const outcome = await page.evaluate(async (identity) => {
        const modulePath = '/src/auth/deviceIdentity.ts';
        const api: typeof import('../../mossy-frontend/src/auth/deviceIdentity') =
            await import(modulePath);
        const db = await api.getDeviceDatabase();
        await db.put('keys', identity, 'current-device');
        await db.put('keys', identity, 'legacy-user');
        const transaction = db.transaction.bind(db);
        db.transaction = ((...args: Parameters<typeof transaction>) => {
            const current = transaction(...args);
            if (args[1] === 'readwrite') queueMicrotask(() => current.abort());
            // The production method awaits both the individual puts and completion.
            // Observe the fixture's forced transaction abort too, preventing an unhandled rejection.
            void current.done.catch(() => undefined);
            return current;
        }) as typeof db.transaction;
        let failed = false;
        try {
            await api.ensureDeviceIdentity();
        } catch {
            failed = true;
        }
        db.transaction = transaction;
        const current = await db.get('keys', 'current-device');
        const legacy = await db.get('keys', 'legacy-user');
        return {
            failed,
            currentUnchanged: current.private === identity.private,
            legacyUnchanged: legacy.private === identity.private,
        };
    }, fixture.identity);
    expect(outcome).toEqual({
        failed: true,
        currentUnchanged: true,
        legacyUnchanged: true,
    });
});
