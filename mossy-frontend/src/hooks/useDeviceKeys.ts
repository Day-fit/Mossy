import { useEffect } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import type { IDBPDatabase } from 'idb';
import {
	type CryptoPair,
	deviceDbRef,
	getDeviceDatabase,
	loadDeviceIdentity,
	loadStoredDeviceId,
} from '../auth/deviceIdentity.ts';
import { useDeviceStore } from '../store/deviceStore.ts';

type UseDeviceKeysResult = {
	generateDhKey: () => Promise<CryptoPair>;
	idKey: CryptoPair | null | undefined;
	deviceId: string | null | undefined;
	dbRef: { current: IDBPDatabase | null };
};

export function useDeviceKeys(): UseDeviceKeysResult {
	const deviceKeys = useDeviceStore((state) => state.idKey);
	const deviceId = useDeviceStore((state) => state.deviceId);
	const setIdKey = useDeviceStore((state) => state.setIdKey);
	const setDeviceId = useDeviceStore((state) => state.setDeviceId);

	useEffect(() => {
		void Promise.all([loadDeviceIdentity(), loadStoredDeviceId()]).then(
			([identity, storedDeviceId]) => {
				setIdKey(identity);
				setDeviceId(storedDeviceId);
			}
		);
	}, [setDeviceId, setIdKey]);

	async function generateDhKey(): Promise<CryptoPair> {
		await sodium.ready;
		const generated = sodium.crypto_box_keypair();
		return {
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
	}

	return {
		generateDhKey,
		idKey: deviceKeys,
		deviceId,
		dbRef: deviceDbRef,
	};
}

void getDeviceDatabase();
