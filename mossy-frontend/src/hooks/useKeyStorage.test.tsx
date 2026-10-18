import { userPasskeyId, vaultKeyId } from '../storage/keyIds.ts';
import { useAuthStore } from '../store/authStore.ts';
import { webcrypto } from 'node:crypto';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CryptoPair } from '../auth/deviceIdentity.ts';
import type {
    StoredUserPasskey,
    StoredVaultKey,
    VaultKeyMetadata,
} from '../types/vaultKey.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';
import { useKeyStorage } from './useKeyStorage.ts';

const database = vi.hoisted(() => ({
    get: vi.fn(),
    put: vi.fn(),
    add: vi.fn(),
}));

vi.mock('../auth/deviceIdentity.ts', () => ({
    getDeviceDatabase: async () => database,
}));

describe('vault key storage', () => {
    const records = new Map<
        string,
        StoredVaultKey | StoredUserPasskey | CryptoPair
    >();
    const passkey = new Uint8Array(new TextEncoder().encode('vault password'));

    beforeEach(() => {
        useAuthStore.setState({
            isAuthenticated: true,
            userDetails: {
                userId: 'user-one',
                email: 'one@example.test',
                username: 'One',
                grantedAuthorities: [],
            },
        });

        vi.stubGlobal('crypto', webcrypto);
        vi.resetAllMocks();
        records.clear();
        useEncryptionStore.setState({ passkeys: {} });
        database.get.mockImplementation(async (_store, id) => records.get(id));
        database.add.mockImplementation(async (_store, record, id) => {
            if (records.has(id))
                throw new DOMException('Key already exists', 'ConstraintError');
            records.set(id, record);
        });
        database.put.mockImplementation(async (_store, record, id) => {
            records.set(id, record);
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it.each<VaultKeyMetadata>([
        { type: 'Text' },
        {
            type: 'PRF',
            credentialId: 'credential-id',
            prfSalt: new Uint8Array(32).fill(7),
        },
    ])(
        'round-trips an imported vault key with $type metadata',
        async (metadata) => {
            const { result } = renderHook(() => useKeyStorage());
            const rawKey = new Uint8Array(32).fill(42);

            await result.current.saveRawKey(
                'vault-one',
                passkey,
                rawKey,
                metadata
            );

            const record = records.get(
                vaultKeyId('user-one', 'vault-one')
            ) as StoredVaultKey;

            expect(record).toEqual({
                ...metadata,
                wrappedKey: expect.anything(),
                salt: expect.any(Uint8Array),
            });
            expect(record.salt).toHaveLength(16);
            expect(new Uint8Array(record.wrappedKey)).not.toEqual(rawKey);
            expect(await result.current.getKeyMetadata('vault-one')).toEqual(
                metadata
            );

            const key = await result.current.loadKey('vault-one', passkey);

            expect(
                new Uint8Array(await crypto.subtle.exportKey('raw', key))
            ).toEqual(rawKey);
        }
    );

    it('uses the current in-memory passkey when encrypting and decrypting after registration', async () => {
        const { result } = renderHook(() => ({
            storage: useKeyStorage(),
            encryption: useEncryptionHook(),
        }));

        await result.current.storage.saveKey('vault-one', passkey, {
            type: 'Text',
        });

        expect(
            await result.current.encryption.isVaultUnlocked('vault-one')
        ).toBe(false);

        act(() =>
            useEncryptionStore.getState().setPasskey('vault-one', passkey)
        );

        expect(
            await result.current.encryption.isVaultUnlocked('vault-one')
        ).toBe(true);

        const encrypted = await result.current.encryption.encrypt(
            'secret',
            'vault-one'
        );

        expect(encrypted).not.toContain('secret');
        expect(
            await result.current.encryption.decrypt(encrypted, 'vault-one')
        ).toBe('secret');
    });

    it('rejects a wrong passkey and clears only the affected vault from memory', async () => {
        const { result } = renderHook(() => useKeyStorage());

        await result.current.saveKey('vault-one', passkey, { type: 'Text' });

        const wrongPasskey = new Uint8Array(
            new TextEncoder().encode('wrong password')
        );

        act(() => {
            useEncryptionStore.getState().setPasskey('vault-one', wrongPasskey);
            useEncryptionStore.getState().setPasskey('vault-two', passkey);
        });

        await expect(
            result.current.loadKey('vault-one', wrongPasskey)
        ).rejects.toThrow('Invalid passkey');
        expect(
            useEncryptionStore.getState().getPasskey('vault-one')
        ).toBeUndefined();
        expect(useEncryptionStore.getState().getPasskey('vault-two')).toEqual(
            passkey
        );
    });

    it('does not treat the device identity or a missing record as a vault key', async () => {
        records.set('current-device', {
            type: 'Ed25519',
            public: 'public',
            private: 'private',
        });
        const { result } = renderHook(() => useKeyStorage());

        await expect(result.current.getKeyMetadata('missing')).rejects.toThrow(
            'Key not found'
        );
        await expect(
            result.current.loadKey('current-device', passkey)
        ).rejects.toThrow('Key not found');
        expect(database.put).not.toHaveBeenCalled();
    });

    it('keeps two vault keys and their PRF metadata separate from the device identity', async () => {
        const identity: CryptoPair = {
            type: 'Ed25519',
            public: 'device-public',
            private: 'device-private',
        };
        records.set('current-device', identity);
        const { result } = renderHook(() => useKeyStorage());
        const vaults = [
            {
                id: 'vault-one',
                rawKey: new Uint8Array(32).fill(1),
                passkey: new Uint8Array(32).fill(2),
            },
            {
                id: 'vault-two',
                rawKey: new Uint8Array(32).fill(3),
                passkey: new Uint8Array(32).fill(4),
            },
        ];
        for (const vault of vaults) {
            await result.current.saveRawKey(
                vault.id,
                vault.passkey,
                vault.rawKey,
                {
                    type: 'PRF',
                    credentialId: `credential-${vault.id}`,
                    prfSalt: new Uint8Array(32).fill(vault.rawKey[0]),
                }
            );
        }
        for (const vault of vaults) {
            const key = await result.current.loadKey(vault.id, vault.passkey);
            expect(
                new Uint8Array(await crypto.subtle.exportKey('raw', key))
            ).toEqual(vault.rawKey);
            expect(await result.current.getKeyMetadata(vault.id)).toEqual({
                type: 'PRF',
                credentialId: `credential-${vault.id}`,
                prfSalt: new Uint8Array(32).fill(vault.rawKey[0]),
            });
        }

        expect(records.size).toBe(3);
        expect(records.get('current-device')).toEqual(identity);
    }, 15_000);
    it('persists only the reusable credential id, separately for each user', async () => {
        const { result } = renderHook(() => useKeyStorage());
        await result.current.saveUserPasskey('credential-one');
        expect(records.get(userPasskeyId('user-one'))).toEqual({
            type: 'UserPRF',
            credentialId: 'credential-one',
        });
        expect(await result.current.getUserPasskey()).toEqual({
            type: 'UserPRF',
            credentialId: 'credential-one',
        });
        await expect(
            result.current.saveUserPasskey('replacement')
        ).rejects.toMatchObject({ name: 'ConstraintError' });

        act(() =>
            useAuthStore.setState({
                userDetails: {
                    ...useAuthStore.getState().userDetails!,
                    userId: 'user-two',
                },
            })
        );
        expect(await result.current.getUserPasskey()).toBeUndefined();
        await result.current.saveUserPasskey('credential-two');
        expect(records.get(userPasskeyId('user-two'))).toEqual({
            type: 'UserPRF',
            credentialId: 'credential-two',
        });
        expect(records.get(userPasskeyId('user-one'))).toEqual({
            type: 'UserPRF',
            credentialId: 'credential-one',
        });
    });

    it('keeps keys for the same vault separate for two users', async () => {
        const { result } = renderHook(() => useKeyStorage());
        const first = new Uint8Array(32).fill(1);
        const second = new Uint8Array(32).fill(2);
        await result.current.saveRawKey('shared', passkey, first, {
            type: 'Text',
        });
        const original = records.get(vaultKeyId('user-one', 'shared'));

        act(() =>
            useAuthStore.setState({
                userDetails: {
                    ...useAuthStore.getState().userDetails!,
                    userId: 'user-two',
                },
            })
        );
        await expect(result.current.getKeyMetadata('shared')).rejects.toThrow(
            'Key not found'
        );
        await result.current.saveRawKey('shared', passkey, second, {
            type: 'Text',
        });
        const key = await result.current.loadKey('shared', passkey);
        expect(
            new Uint8Array(await crypto.subtle.exportKey('raw', key))
        ).toEqual(second);
        expect(records.get(vaultKeyId('user-one', 'shared'))).toEqual(original);
        expect(records.has(vaultKeyId('user-two', 'shared'))).toBe(true);
    }, 15_000);
});
