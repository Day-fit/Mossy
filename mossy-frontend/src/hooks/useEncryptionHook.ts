import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { type IDBPDatabase, openDB } from 'idb';
import { KeyNotFoundException } from '../exception/KeyNotFoundException.ts';
import { useAuth } from '../context/AuthContext.tsx';

type EncryptionKeys = Record<string, string | undefined>;

export type UseEncryptionResult = {
	encrypt: (password: string, vaultId: string) => Promise<string>;
	decrypt: (ciphertext: string, vaultId: string) => Promise<string>;
	isPinPresent: (id: string) => Promise<boolean>;
	saveKey: (id: string, pin: string) => Promise<void>;
	loadKey: (id: string, pin: string) => Promise<CryptoKey>;
	encryptionPins: RefObject<EncryptionKeys>;
	generateDeviceKeys: () => Promise<KeyRecord>;
	deviceKeys: KeyRecord | null;
};

type KeyPair = {
	public: string;
	private: string;
};

type KeyType = 'X25519' | 'Ed25519';

export type KeyRecord = Record<KeyType, KeyPair>;

export function useEncryptionHook(): UseEncryptionResult {
	const { userDetails } = useAuth();
	const [deviceKeys, setDeviceKeys] = useState<KeyRecord | null>(null);
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

	useEffect(() => {
		const db = dbRef.current;
		if (!db || !userDetails?.userId) return;

		db.get('mossy', userDetails.userId).then((keys) => {
			if (keys) setDeviceKeys(keys);
		});
	}, [userDetails?.userId, dbRef]);

	const encryptionPins = useRef<EncryptionKeys>({});

	async function generateDeviceKeys(): Promise<KeyRecord> {
		if (deviceKeys) throw new Error('Device keys already generated');

		const db = dbRef.current;

		if (!db) {
			throw new Error('Database not initialized');
		}

		const userId = userDetails?.userId;

		if (!userId) {
			throw new Error('No userId was provided');
		}

		await sodium.ready;

		const dhKeys = sodium.crypto_box_keypair();
		const idKeys = sodium.crypto_sign_keypair();

		const keys: KeyRecord = {
			X25519: {
				private: sodium.to_base64(
					dhKeys.privateKey,
					sodium.base64_variants.URLSAFE_NO_PADDING
				),
				public: sodium.to_base64(
					dhKeys.publicKey,
					sodium.base64_variants.URLSAFE_NO_PADDING
				),
			},
			Ed25519: {
				private: sodium.to_base64(
					idKeys.privateKey,
					sodium.base64_variants.URLSAFE_NO_PADDING
				),
				public: sodium.to_base64(
					idKeys.publicKey,
					sodium.base64_variants.URLSAFE_NO_PADDING
				),
			},
		};

		await db.put('mossy', keys, userId);

		return keys;
	}

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
					false,
					['encrypt', 'decrypt']
				)
				.catch(() => {
					encryptionPins.current[id] = undefined;
					throw new Error('Invalid pin');
				});
		},
		[encryptionPins]
	);

	const encrypt = useCallback(
		async (password: string, vaultId: string) => {
			const pin = encryptionPins.current[vaultId];
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
			const pin = encryptionPins.current[vaultId];

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
		async (id: string) => {
			const db = dbRef.current;

			if (!db) {
				throw new Error('Database not initialized');
			}

			const keyRecord = await db.get('keys', id);

			if (!keyRecord?.wrappedKey || !keyRecord?.salt) {
				throw new KeyNotFoundException('Key not found');
			}

			return encryptionPins.current[id] !== undefined;
		},
		[encryptionPins]
	);

	return {
		encrypt,
		decrypt,
		isPinPresent,
		saveKey,
		loadKey,
		encryptionPins,
		deviceKeys,
		generateDeviceKeys,
	};
}
