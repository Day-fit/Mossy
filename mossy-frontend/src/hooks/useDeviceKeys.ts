import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { type IDBPDatabase, openDB } from 'idb';
import { useAuth } from '../context/AuthContext.tsx';

type KeyPair = {
	public: string;
	private: string;
};

type KeyType = 'X25519' | 'Ed25519';

export type KeyRecord = Record<KeyType, KeyPair>;

export type UseDeviceKeysResult = {
	generateDeviceKeys: () => Promise<KeyRecord>;
	deviceKeys: KeyRecord | null;
	dbRef: React.RefObject<IDBPDatabase | null>;
};

export function useDeviceKeys(): UseDeviceKeysResult {
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

	return {
		generateDeviceKeys,
		deviceKeys,
		dbRef,
	};
}

