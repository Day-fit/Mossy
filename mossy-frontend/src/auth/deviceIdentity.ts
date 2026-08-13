import { openDB, type IDBPDatabase } from 'idb';
import sodium from 'libsodium-wrappers-sumo';

export type KeyPair = {
	public: string;
	private: string;
};

export type CryptoPair =
	| ({ type: 'Ed25519' } & KeyPair)
	| ({ type: 'X25519' } & KeyPair);

const CURRENT_IDENTITY_KEY = 'current-device';
const DEVICE_ID_KEY = 'deviceId';

export const deviceDbRef: { current: IDBPDatabase | null } = {
	current: null,
};

let dbInitializationPromise: Promise<IDBPDatabase> | null = null;

export async function getDeviceDatabase(): Promise<IDBPDatabase> {
	if (deviceDbRef.current) return deviceDbRef.current;

	if (!dbInitializationPromise) {
		dbInitializationPromise = openDB('mossy', 2, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('keys')) {
					db.createObjectStore('keys');
				}
				if (!db.objectStoreNames.contains('device')) {
					db.createObjectStore('device');
				}
			},
		}).then((db) => {
			deviceDbRef.current = db;
			return db;
		});
	}

	return dbInitializationPromise;
}

export async function loadDeviceIdentity(
	legacyUserId?: string
): Promise<CryptoPair | null> {
	const db = await getDeviceDatabase();
	const current = (await db.get('keys', CURRENT_IDENTITY_KEY)) as
		| CryptoPair
		| undefined;
	if (current) return current;

	const legacy = legacyUserId
		? ((await db.get('keys', legacyUserId)) as CryptoPair | undefined)
		: undefined;
	if (legacy) {
		await db.put('keys', legacy, CURRENT_IDENTITY_KEY);
		return legacy;
	}

	// Older builds keyed the only local identity by user id. Since the device id
	// was global as well, a single legacy identity can be migrated unambiguously.
	const legacyIdentities = (await db.getAll('keys')).filter(
		(value): value is CryptoPair => value?.type === 'Ed25519'
	);
	if (legacyIdentities.length === 1) {
		await db.put('keys', legacyIdentities[0], CURRENT_IDENTITY_KEY);
		return legacyIdentities[0];
	}

	return null;
}

export async function ensureDeviceIdentity(): Promise<CryptoPair> {
	const stored = await loadDeviceIdentity();
	if (stored) return stored;

	await sodium.ready;
	const generated = sodium.crypto_sign_keypair();
	const identity: CryptoPair = {
		type: 'Ed25519',
		private: sodium.to_base64(
			generated.privateKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		),
		public: sodium.to_base64(
			generated.publicKey,
			sodium.base64_variants.URLSAFE_NO_PADDING
		),
	};

	const db = await getDeviceDatabase();
	await db.put('keys', identity, CURRENT_IDENTITY_KEY);
	return identity;
}

export async function loadStoredDeviceId(): Promise<string | null> {
	const db = await getDeviceDatabase();
	return ((await db.get('device', DEVICE_ID_KEY)) as string | undefined) ?? null;
}

export async function storeDeviceId(deviceId: string): Promise<void> {
	const db = await getDeviceDatabase();
	await db.put('device', deviceId, DEVICE_ID_KEY);
}

export async function signNonce(
	nonce: string,
	identity: CryptoPair
): Promise<string> {
	if (identity.type !== 'Ed25519') {
		throw new Error('The local device identity is not an Ed25519 key');
	}

	await sodium.ready;
	const signature = sodium.crypto_sign_detached(
		sodium.from_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING),
		sodium.from_base64(
			identity.private,
			sodium.base64_variants.URLSAFE_NO_PADDING
		)
	);
	return sodium.to_base64(
		signature,
		sodium.base64_variants.URLSAFE_NO_PADDING
	);
}
