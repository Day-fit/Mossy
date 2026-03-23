import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { type IDBPDatabase, openDB } from 'idb';

export type UseEncryptionResult = {
	encrypt: (password: string, vaultId: string) => Promise<string>;
	decrypt: (ciphertext: string, vaultId: string) => Promise<string>;
	isPinPresent: (id: string) => boolean;
	setEncryptionPin: Dispatch<
		SetStateAction<Record<string, string | undefined>>
	>;
	saveKey: (id: string, pin: string) => Promise<void>;
	loadKey: (id: string, pin: string) => Promise<CryptoKey>;
};

export function useEncryption(): UseEncryptionResult {
	const dbRef = useRef<IDBPDatabase | null>(null);

	useEffect(() => {
		openDB('mossy', 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('keys')) {
					db.createObjectStore('keys');
				}
			},
		}).then((db) => (dbRef.current = db));

		return () => dbRef.current?.close();
	}, []);

	const [encryptionPins, setEncryptionPins] = useState<
		Record<string, string | undefined>
	>({});

	const loadKey = useCallback(
		async (id: string, pin: string) => {
			const db = dbRef.current;

			if (!db) {
				throw new Error('Database not initialized');
			}

			await sodium.ready;

			const { wrappedKey, salt } = await db.get('keys', id);

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
					false,
					['encrypt', 'decrypt']
				)
				.catch(() => {
					encryptionPins[id] = undefined;
					throw new Error('Invalid pin');
				});
		},
		[encryptionPins]
	);

	const encrypt = useCallback(
		async (password: string, vaultId: string) => {
			const pin = encryptionPins[vaultId];
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
		[encryptionPins, loadKey]
	);

	const decrypt = useCallback(
		async (ciphertext: string, vaultId: string) => {
			const pin = encryptionPins[vaultId];

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
		[encryptionPins, loadKey]
	);

	const saveKey = useCallback(async (id: string, pin: string) => {
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

		const dataKey = await crypto.subtle.generateKey(
			{ name: 'AES-GCM', length: 256 },
			true,
			['encrypt', 'decrypt']
		);

		const wrappedKey = await crypto.subtle.wrapKey(
			'raw',
			dataKey,
			wrappingKey,
			'AES-KW'
		);

		await db.put('keys', { wrappedKey, salt }, id);
	}, []);

	const isPinPresent = useCallback(
		(id: string) => {
			console.log(encryptionPins);
			return encryptionPins[id] !== undefined;
		},
		[encryptionPins]
	);

	return {
		encrypt,
		decrypt,
		isPinPresent,
		setEncryptionPin: setEncryptionPins,
		saveKey,
		loadKey,
	};
}
