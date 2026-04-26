import { useEffect } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { openDB, type IDBPDatabase } from 'idb';
import { useDeviceStore } from '../store/deviceStore';
import type { CryptoPair } from '../types';

const sharedDbRef: { current: IDBPDatabase | null } = { current: null };
let dbInitializationPromise: Promise<IDBPDatabase> | null = null;

async function getOrCreateDatabase(): Promise<IDBPDatabase> {
  if (sharedDbRef.current) return sharedDbRef.current;

  if (!dbInitializationPromise) {
    dbInitializationPromise = openDB('mossy-extension', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
        if (!db.objectStoreNames.contains('device')) db.createObjectStore('device');
      },
    }).then((db) => {
      sharedDbRef.current = db;
      return db;
    });
  }

  return dbInitializationPromise;
}

export function useDeviceKeys(userId?: string) {
  const deviceKeys = useDeviceStore((state) => state.idKey);
  const deviceId = useDeviceStore((state) => state.deviceId);
  const setIdKey = useDeviceStore((state) => state.setIdKey);
  const setDhKey = useDeviceStore((state) => state.setDhKey);
  const setDeviceId = useDeviceStore((state) => state.setDeviceId);

  useEffect(() => {
    void getOrCreateDatabase();
  }, []);

  useEffect(() => {
    if (!userId) return;

    void (async () => {
      const db = await getOrCreateDatabase();
      const storedKeys = (await db.get('keys', userId)) as CryptoPair | null | undefined;
      const storedDeviceId = (await db.get('device', `deviceId:${userId}`)) as string | null | undefined;
      setIdKey(storedKeys);
      setDeviceId(storedDeviceId);
    })();
  }, [setDeviceId, setIdKey, userId]);

  async function generateIdKey(): Promise<CryptoPair> {
    if (!userId) throw new Error('No userId was provided');

    const db = await getOrCreateDatabase();
    const existingStoreKey = useDeviceStore.getState().idKey;
    if (existingStoreKey) return existingStoreKey;

    const existingStoredKey = (await db.get('keys', userId)) as CryptoPair | null | undefined;
    if (existingStoredKey) {
      setIdKey(existingStoredKey);
      return existingStoredKey;
    }

    await sodium.ready;

    const idKeys = sodium.crypto_sign_keypair();
    const keys: CryptoPair = {
      type: 'Ed25519',
      private: sodium.to_base64(idKeys.privateKey, sodium.base64_variants.URLSAFE_NO_PADDING),
      public: sodium.to_base64(idKeys.publicKey, sodium.base64_variants.URLSAFE_NO_PADDING),
    };

    await db.put('keys', keys, userId);
    setIdKey(keys);
    return keys;
  }

  async function generateDhKey(): Promise<CryptoPair> {
    await sodium.ready;
    const dhKeys = sodium.crypto_box_keypair();

    const keys: CryptoPair = {
      type: 'X25519',
      private: sodium.to_base64(dhKeys.privateKey, sodium.base64_variants.URLSAFE_NO_PADDING),
      public: sodium.to_base64(dhKeys.publicKey, sodium.base64_variants.URLSAFE_NO_PADDING),
    };

    setDhKey(keys);
    return keys;
  }

  async function saveDeviceId(id: string): Promise<void> {
    if (!userId) throw new Error('No userId was provided');
    const db = await getOrCreateDatabase();
    setDeviceId(id);
    await db.put('device', id, `deviceId:${userId}`);
  }

  return {
    generateIdKey,
    generateDhKey,
    idKey: deviceKeys,
    saveDeviceId,
    deviceId,
    dbRef: sharedDbRef,
    getDatabase: getOrCreateDatabase,
  };
}
