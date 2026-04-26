import { useCallback } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { useDeviceKeys } from './useDeviceKeys';
import { useEncryptionStore } from '../store/encryptionStore';
import { KeyNotFoundException } from '../exception/KeyNotFoundException';

export function useEncryptionHook() {
  const deviceKeysHook = useDeviceKeys();
  const dbRef = deviceKeysHook.dbRef;
  const getDatabase = deviceKeysHook.getDatabase;
  const setPin = useEncryptionStore((state) => state.setPin);
  const clearPin = useEncryptionStore((state) => state.clearPin);

  const resolveDb = useCallback(async () => dbRef.current ?? (await getDatabase()), [dbRef, getDatabase]);

  const loadKey = useCallback(
    async (id: string, pin: string) => {
      const db = await resolveDb();

      await sodium.ready;

      const keyRecord = await db.get('keys', `vault:${id}`);
      if (!keyRecord?.wrappedKey || !keyRecord?.salt) {
        throw new KeyNotFoundException('Key not found');
      }

      const pinBytes = sodium.crypto_pwhash(
        32,
        pin,
        keyRecord.salt,
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
        .unwrapKey('raw', keyRecord.wrappedKey, wrappingKey, 'AES-KW', { name: 'AES-GCM', length: 256 }, true, [
          'encrypt',
          'decrypt',
        ])
        .catch(() => {
          clearPin(id);
          throw new Error('Invalid pin');
        });
    },
    [clearPin, resolveDb]
  );

  const wrapAndStore = useCallback(
    async (vaultId: string, pin: string, dataKey: CryptoKey) => {
      const db = await resolveDb();

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

      const wrappedKey = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, 'AES-KW');
      await db.put('keys', { wrappedKey, salt }, `vault:${vaultId}`);
    },
    [resolveDb]
  );

  const saveRawKey = useCallback(
    async (vaultId: string, pin: string, rawKey: Uint8Array<ArrayBuffer>) => {
      const dataKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);

      await wrapAndStore(vaultId, pin, dataKey);
    },
    [wrapAndStore]
  );

  const encrypt = useCallback(
    async (password: string, vaultId: string) => {
      const pin = useEncryptionStore.getState().pins[vaultId];
      if (!pin) throw new Error('Pin not found');

      const iv = new Uint8Array(sodium.randombytes_buf(12));
      const loadedKey = await loadKey(vaultId, pin);
      const plaintext = new TextEncoder().encode(password);
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, loadedKey, plaintext));

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
      if (!pin) throw new Error('Pin not found');

      const loadedKey = await loadKey(vaultId, pin);
      const blob = new Uint8Array(atob(ciphertext).split('').map((c) => c.charCodeAt(0)));
      const iv = blob.slice(0, 12);
      const ciphertextBytes = blob.slice(12);
      const decryptedBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, loadedKey, ciphertextBytes);

      return new TextDecoder().decode(decryptedBytes);
    },
    [loadKey]
  );

  const isPinPresent = useCallback(
    async (id: string) => {
      const db = await resolveDb();
      const keyRecord = await db.get('keys', `vault:${id}`);

      if (!keyRecord?.wrappedKey || !keyRecord?.salt) {
        throw new KeyNotFoundException('Key not found');
      }

      return useEncryptionStore.getState().pins[id] !== undefined;
    },
    [resolveDb]
  );

  return { encrypt, decrypt, isPinPresent, saveRawKey, loadKey, setPin };
}
