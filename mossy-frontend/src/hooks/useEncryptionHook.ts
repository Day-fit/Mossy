import { useCallback } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';

export type UseEncryptionResult = {
	encrypt: (password: string, vaultId: string) => Promise<string>;
	decrypt: (ciphertext: string, vaultId: string) => Promise<string>;
	isPinPresent: (id: string) => Promise<boolean>;
	saveKey: (id: string, pin: string) => Promise<void>;
	saveRawKey: (
		vaultId: string,
		pin: string,
		rawKey: Uint8Array<ArrayBuffer>
	) => Promise<void>;
	loadKey: (id: string, pin: string) => Promise<CryptoKey>;
	setPin: (vaultId: string, pin: string) => void;
};

export function useEncryptionHook(): UseEncryptionResult {
	const deviceKeysHook = useDeviceKeys();
	const dbRef = deviceKeysHook.dbRef;
	const setPin = useEncryptionStore((state) => state.setPin);
	const clearPin = useEncryptionStore((state) => state.clearPin);

	const loadKey = useCallback(
		async (id: string, pin: string) => {
			const db = dbRef.current;

			if (!db) {
				throw new Error('Database not initialized');
			}

			await sodium.ready;

			const keyRecord = await db.get('keys', id);

			if (!keyRecord?.wrappedKey || !keyRecord?.salt) {
				throw new KeyNotFoundException('Key not found');
			}

			const { wrappedKey, salt } = keyRecord;

			const pinBytes = sodium.crypto_pwhash(
				32,
				pin,
				salt,
				sodium.crypto_pwhash_OPSLIMIT_MODERATE,
				sodium.crypto_pwhash_MEMLIMIT_MODERATE,
				sodium.crypto_pwhash_ALG_ARGON2ID13
			);

			const wrappingKey = await crypto.subtle.importKey(
				'raw',
				new Uint8Array(pinBytes),
				{ name: 'AES-KW', length: 256 },
				false,
				['wrapKey', 'unwrapKey']
			);

			return await crypto.subtle
				.unwrapKey(
					'raw',
					wrappedKey,
					wrappingKey,
					'AES-KW',
					{ name: 'AES-GCM', length: 256 },
					true,
					['encrypt', 'decrypt']
				)
				.catch(() => {
					clearPin(id);
					throw new Error('Invalid pin');
				});
		},
		[clearPin, dbRef]
	);

	const encrypt = useCallback(
		async (password: string, vaultId: string) => {
			const pin = useEncryptionStore.getState().pins[vaultId];

			if (!pin) {
				throw new Error('Pin not found');
			}

			const iv = new Uint8Array(sodium.randombytes_buf(12));

			const loadedKey = await loadKey(vaultId, pin);
			const encoder = new TextEncoder();
			const plaintext = encoder.encode(password);

			const ciphertext = new Uint8Array(
				await crypto.subtle.encrypt(
					{ name: 'AES-GCM', iv },
					loadedKey,
					plaintext
				)
			);

			const blob = new Uint8Array(iv.length + ciphertext.length);
			blob.set(iv, 0);
			blob.set(ciphertext, 12);

			return btoa(String.fromCharCode(...blob));
		},
		[loadKey]
	);

	const decrypt = useCallback(
		async (ciphertext: string, vaultId: string) => {
			const pin = useEncryptionStore.getState().pins[vaultId];

			if (!pin) {
				throw new Error('Pin not found');
			}

			const loadedKey = await loadKey(vaultId, pin);
			const blob = new Uint8Array(
				atob(ciphertext)
					.split('')
					.map((c) => c.charCodeAt(0))
			);

			const iv = blob.slice(0, 12);
			const ciphertextBytes = blob.slice(12);

			const decryptedBytes = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: new Uint8Array(iv) },
				loadedKey,
				ciphertextBytes
			);

			return new TextDecoder().decode(decryptedBytes);
		},
		[loadKey]
	);

	const wrapAndStore = useCallback(
		async (vaultId: string, pin: string, dataKey: CryptoKey) => {
			const db = dbRef.current;

			if (!db) {
				throw new Error('Database not initialized');
			}

			await sodium.ready;

			const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

			const pinBytes = sodium.crypto_pwhash(
				32,
				pin,
				salt,
				sodium.crypto_pwhash_OPSLIMIT_MODERATE,
				sodium.crypto_pwhash_MEMLIMIT_MODERATE,
				sodium.crypto_pwhash_ALG_ARGON2ID13
			);

			const wrappingKey = await crypto.subtle.importKey(
				'raw',
				new Uint8Array(pinBytes),
				{ name: 'AES-KW', length: 256 },
				false,
				['wrapKey', 'unwrapKey']
			);

			const wrappedKey = await crypto.subtle.wrapKey(
				'raw',
				dataKey,
				wrappingKey,
				'AES-KW'
			);

			await db.put('keys', { wrappedKey, salt }, vaultId);
		},
		[dbRef]
	);

	const saveKey = useCallback(
		async (vaultId: string, pin: string) => {
			const dataKey = await crypto.subtle.generateKey(
				{ name: 'AES-GCM', length: 256 },
				true,
				['encrypt', 'decrypt']
			);

			await wrapAndStore(vaultId, pin, dataKey);
		},
		[wrapAndStore]
	);

	const saveRawKey = useCallback(
		async (
			vaultId: string,
			pin: string,
			rawKey: Uint8Array<ArrayBuffer>
		) => {
			const dataKey = await crypto.subtle.importKey(
				'raw',
				rawKey,
				{ name: 'AES-GCM', length: 256 },
				true,
				['encrypt', 'decrypt']
			);

			await wrapAndStore(vaultId, pin, dataKey);
		},
		[wrapAndStore]
	);

	const isPinPresent = useCallback(
		async (id: string) => {
			const db = dbRef.current;

			if (!db) {
				throw new Error('Database not initialized');
			}

			const keyRecord = await db.get('keys', id);

			if (!keyRecord?.wrappedKey || !keyRecord?.salt) {
				throw new KeyNotFoundException('Key not found');
			}

			return useEncryptionStore.getState().pins[id] !== undefined;
		},
		[dbRef]
	);

	return {
		encrypt,
		decrypt,
		isPinPresent,
		saveKey,
		saveRawKey,
		loadKey,
		setPin,
	};
}
