import { test, expect } from './fixtures/extension';
import { pageRpc, uiSnapshot, completeAndClose } from './helpers/actions';
import { receiveFixtureKey } from './helpers/key-sync';
import { importWrappingKey, unwrapVaultKey } from '../src/security/vaultCrypto';
import { type WrappedKeyRecord } from '../src/types/vault';

for (const method of [
    'Use existing passkey',
    'Register new passkey',
] as const) {
    test(`received keys follow main's ${method} flow, including cancellation and credential persistence`, async ({
        extension: app,
    }) => {
        await app.signIn();

        const action = await receiveFixtureKey(app);
        for (const theme of ['light', 'dark'] as const) {
            await pageRpc(app.popup, { type: 'setTheme', theme });
            await expect(action.locator('html')).toHaveAttribute(
                'data-theme',
                theme
            );
            await uiSnapshot(action, `protection-choices-${theme}`);
        }

        // Native authenticator prompts are simulated with deterministic outputs.
        await action.evaluate(() => {
            const calls: {
                operation: string;
                rpId: string;
                vaultId: string;
                name?: string;
                allowed?: number[];
                salt: string;
            }[] = [];
            Object.defineProperty(globalThis, 'passkeyCalls', { value: calls });

            let cancel = true;
            let registered = false;
            class FixtureCredential {
                rawId = new Uint8Array(registered ? [9, 8, 7] : [1, 2, 3])
                    .buffer;
                response = {
                    userHandle: new TextEncoder().encode(
                        '10000000-0000-4000-8000-000000000002'
                    ).buffer,
                };

                getClientExtensionResults() {
                    return {
                        prf: {
                            enabled: true,
                            results: {
                                first: new Uint8Array(32).fill(17).buffer,
                            },
                        },
                    };
                }
            }
            Object.defineProperty(globalThis, 'PublicKeyCredential', {
                value: FixtureCredential,
            });
            Object.defineProperty(navigator, 'credentials', {
                value: {
                    async get({ publicKey }: CredentialRequestOptions) {
                        calls.push({
                            operation: 'get',
                            rpId: publicKey!.rpId!,
                            vaultId: '10000000-0000-4000-8000-000000000002',
                            allowed: publicKey!.allowCredentials
                                ?.map((c) =>
                                    Array.from(
                                        new Uint8Array(c.id as ArrayBuffer)
                                    )
                                )
                                .flat(),
                            salt: new TextDecoder().decode(
                                publicKey!.extensions!.prf!.eval!.first
                            ),
                        });

                        if (cancel) {
                            cancel = false;
                            throw new DOMException(
                                'Canceled',
                                'NotAllowedError'
                            );
                        }

                        return new FixtureCredential();
                    },
                    async create({ publicKey }: CredentialCreationOptions) {
                        calls.push({
                            operation: 'create',
                            rpId: publicKey!.rp.id!,
                            vaultId: new TextDecoder().decode(
                                publicKey!.user.id
                            ),
                            name: publicKey!.user.name,
                            salt: new TextDecoder().decode(
                                publicKey!.extensions!.prf!.eval!.first
                            ),
                        });

                        if (cancel) {
                            cancel = false;
                            throw new DOMException(
                                'Canceled',
                                'NotAllowedError'
                            );
                        }

                        registered = true;

                        return new FixtureCredential();
                    },
                },
            });
        });
        await action.getByRole('button', { name: method, exact: true }).click();

        await uiSnapshot(
            action,
            method === 'Register new passkey'
                ? 'register-passkey-warning'
                : 'use-existing-passkey'
        );

        if (method === 'Register new passkey') {
            await expect(
                action.getByText('This may replace an existing passkey')
            ).toBeVisible();
        }

        await action.getByRole('button', { name: method, exact: true }).click();
        await expect(action.getByRole('alert')).toContainText(
            'The passkey prompt was closed. Try again or choose another method.'
        );
        await uiSnapshot(action, 'passkey-cancelled');

        const firstCalls = await action.evaluate(() =>
            Reflect.get(globalThis, 'passkeyCalls')
        );

        expect(firstCalls).toHaveLength(1);
        expect(firstCalls[0].operation).toBe(
            method === 'Use existing passkey' ? 'get' : 'create'
        );
        expect(firstCalls[0].rpId).toBe('mossy.dayfit.pl');
        expect(firstCalls[0].salt).toBe(
            'mossy:encryption:v1:vault:10000000-0000-4000-8000-000000000002'
        );

        if (method === 'Use existing passkey') {
            expect(firstCalls[0].allowed).toEqual([1, 2, 3]);
        } else {
            expect(firstCalls[0].vaultId).toBe(
                '10000000-0000-4000-8000-000000000002'
            );
            expect(firstCalls[0].name).toBeTruthy();
        }

        await expect(
            action.getByRole('button', { name: 'Choose another method' })
        ).toBeVisible();
        await action.getByRole('button', { name: method, exact: true }).click();
        await completeAndClose(action);

        const stored = await app.popup.evaluate(async () => {
            const database = await new Promise<IDBDatabase>((resolve) => {
                const request = indexedDB.open('mossy-extension-v2');
                request.onsuccess = () => resolve(request.result);
            });
            const record = await new Promise<WrappedKeyRecord>((resolve) => {
                const request = database
                    .transaction('wrapped')
                    .objectStore('wrapped')
                    .get(
                        JSON.stringify([
                            'https://mossy.dayfit.pl',
                            'user-1',
                            '10000000-0000-4000-8000-000000000002',
                        ])
                    );
                request.onsuccess = () => resolve(request.result);
            });
            database.close();

            return {
                type: record.type,
                wrappedKey: Array.from(new Uint8Array(record.wrappedKey)),
                credentialId:
                    record.type === 'PRF'
                        ? Array.from(new Uint8Array(record.credentialId))
                        : [],
            };
        });

        expect(stored.type).toBe('PRF');
        expect(stored.credentialId).toEqual(
            method === 'Use existing passkey' ? [1, 2, 3] : [9, 8, 7]
        );

        const wrapping = await importWrappingKey(new Uint8Array(32).fill(17));
        const key = await unwrapVaultKey(
            {
                type: 'PRF',
                wrappedKey: new Uint8Array(stored.wrappedKey).buffer,
                credentialId: new Uint8Array(stored.credentialId).buffer,
            },
            wrapping,
            true
        );

        expect(
            Array.from(
                new Uint8Array(await crypto.subtle.exportKey('raw', key))
            )
        ).toEqual(app.vault.rawKey);
    });
}
