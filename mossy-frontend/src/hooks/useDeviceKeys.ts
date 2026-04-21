import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { type IDBPDatabase, openDB } from 'idb';
import * as React from 'react';

type KeyPair = {
	public: string;
	private: string;
};

type KeyType = 'X25519' | 'Ed25519';

export type KeyRecord = Record<KeyType, KeyPair>;

export type UseDeviceKeysResult = {
	generateDeviceKeys: () => Promise<KeyRecord>;
	deviceKeys: KeyRecord | null | undefined;
	deviceId: string | null | undefined;
	saveDeviceId: (id: string) => Promise<void>;
	dbRef: React.RefObject<IDBPDatabase | null>;
};

export function useDeviceKeys(userId?: string): UseDeviceKeysResult {
	const [deviceKeys, setDeviceKeys] = useState<KeyRecord | null | undefined>(
		null
	);
	const [deviceId, setDeviceId] = useState<string | null | undefined>(null);
	const [dbReady, setDbReady] = useState(false);
	const dbRef = useRef<IDBPDatabase | null>(null);

	useEffect(() => {
		openDB('mossy', 2, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('keys')) {
					db.createObjectStore('keys');
				}
				if (!db.objectStoreNames.contains('device')) {
					db.createObjectStore('device');
				}
			},
		}).then((db) => {
			dbRef.current = db;
			setDbReady(true);
		});

		return () => dbRef.current?.close();
	}, []);

	useEffect(() => {
		if (!dbReady || !userId) return;

		const db = dbRef.current!;

		db.get('keys', userId).then((keys) => {
			setDeviceKeys(keys);
		});

		db.get('device', 'deviceId').then((id) => {
			setDeviceId(id);
		});
	}, [dbReady, userId]);

	async function generateDeviceKeys(): Promise<KeyRecord> {
		if (deviceKeys) throw new Error('Device keys already generated');

		const db = dbRef.current;

		if (!db) {
			throw new Error('Database not initialized');
		}

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

		await db.put('keys', keys, userId);
		setDeviceKeys(keys);

		return keys;
	}

	async function saveDeviceId(id: string): Promise<void> {
		const db = dbRef.current;

		if (!db) {
			throw new Error('Database not initialized');
		}

		await db.put('device', id, 'deviceId');
		setDeviceId(id);
	}

	return {
		generateDeviceKeys,
		deviceKeys,
		saveDeviceId,
		deviceId,
		dbRef,
	};
}
