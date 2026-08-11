import { useEffect } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import type { IDBPDatabase } from 'idb';
import {
	deviceDbRef,
	ensureDeviceIdentity,
	getDeviceDatabase,
	loadDeviceIdentity,
	loadStoredDeviceId,
	storeDeviceId,
	type CryptoPair,
} from '../auth/deviceIdentity.ts';
import { useDeviceStore } from '../store/deviceStore.ts';

export type { CryptoPair } from '../auth/deviceIdentity.ts';

export type UseDeviceKeysResult = {
	generateIdKey: () => Promise<CryptoPair>;
	generateDhKey: () => Promise<CryptoPair>;
	clearDhKey: () => void;
	idKey: CryptoPair | null | undefined;
	deviceId: string | null | undefined;
	saveDeviceId: (id: string) => Promise<void>;
	dbRef: { current: IDBPDatabase | null };
};

export function useDeviceKeys(userId?: string): UseDeviceKeysResult {
	const deviceKeys = useDeviceStore((state) => state.idKey);
	const deviceId = useDeviceStore((state) => state.deviceId);
	const setIdKey = useDeviceStore((state) => state.setIdKey);
	const setDhKey = useDeviceStore((state) => state.setDhKey);
	const setDeviceId = useDeviceStore((state) => state.setDeviceId);

	useEffect(() => {
		void Promise.all([loadDeviceIdentity(userId), loadStoredDeviceId()]).then(
			([identity, storedDeviceId]) => {
				setIdKey(identity);
				setDeviceId(storedDeviceId);
			}
		);
	}, [setDeviceId, setIdKey, userId]);

	async function generateIdKey(): Promise<CryptoPair> {
		const identity = await ensureDeviceIdentity();
		setIdKey(identity);
		return identity;
	}

	async function generateDhKey(): Promise<CryptoPair> {
		await sodium.ready;
		const generated = sodium.crypto_box_keypair();
		const keys: CryptoPair = {
			type: 'X25519',
			private: sodium.to_base64(
				generated.privateKey,
				sodium.base64_variants.URLSAFE_NO_PADDING
			),
			public: sodium.to_base64(
				generated.publicKey,
				sodium.base64_variants.URLSAFE_NO_PADDING
			),
		};

		setDhKey(keys);
		return keys;
	}

	async function saveDeviceId(id: string): Promise<void> {
		await storeDeviceId(id);
		setDeviceId(id);
	}

	return {
		generateIdKey,
		generateDhKey,
		clearDhKey: () => setDhKey(null),
		idKey: deviceKeys,
		saveDeviceId,
		deviceId,
		dbRef: deviceDbRef,
	};
}

void getDeviceDatabase();
