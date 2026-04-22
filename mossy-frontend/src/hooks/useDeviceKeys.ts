import { useEffect } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { type IDBPDatabase, openDB } from 'idb';
import { useDeviceStore } from '../store/deviceStore.ts';

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
dbRef: { current: IDBPDatabase | null };
};

const sharedDbRef: { current: IDBPDatabase | null } = {
current: null,
};

let dbInitializationPromise: Promise<IDBPDatabase> | null = null;

async function getOrCreateDatabase(): Promise<IDBPDatabase> {
if (sharedDbRef.current) {
return sharedDbRef.current;
}

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
sharedDbRef.current = db;
return db;
});
}

return dbInitializationPromise;
}

export function useDeviceKeys(userId?: string): UseDeviceKeysResult {
const deviceKeys = useDeviceStore((state) => state.deviceKeys);
const deviceId = useDeviceStore((state) => state.deviceId);
const setDeviceKeys = useDeviceStore((state) => state.setDeviceKeys);
const setDeviceId = useDeviceStore((state) => state.setDeviceId);

useEffect(() => {
void getOrCreateDatabase();
}, []);

useEffect(() => {
if (!userId) return;

void (async () => {
const db = await getOrCreateDatabase();
const storedKeys = (await db.get('keys', userId)) as
| KeyRecord
| null
| undefined;
const storedDeviceId = (await db.get('device', 'deviceId')) as
| string
| null
| undefined;

setDeviceKeys(storedKeys);
setDeviceId(storedDeviceId);
})();
}, [setDeviceId, setDeviceKeys, userId]);

async function generateDeviceKeys(): Promise<KeyRecord> {
if (useDeviceStore.getState().deviceKeys) {
throw new Error('Device keys already generated');
}

if (!userId) {
throw new Error('No userId was provided');
}

const db = await getOrCreateDatabase();

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
const db = await getOrCreateDatabase();
setDeviceId(id);
await db.put('device', id, 'deviceId');
}

return {
generateDeviceKeys,
deviceKeys,
saveDeviceId,
deviceId,
dbRef: sharedDbRef,
};
}
