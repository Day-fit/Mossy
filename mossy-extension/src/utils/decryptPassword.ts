import { openDB } from 'idb';
import sodium from 'libsodium-wrappers-sumo';

type KeyRecord = {
  wrappedKey: ArrayBuffer;
  salt: Uint8Array;
};

async function openExtensionDb() {
  return openDB('mossy-extension', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
      if (!db.objectStoreNames.contains('device')) db.createObjectStore('device');
    },
  });
}

export async function decryptPassword(
  ciphertext: string,
  vaultId: string,
  pin: string,
): Promise<string> {
  const db = await openExtensionDb();
  const keyRecord = (await db.get('keys', `vault:${vaultId}`)) as KeyRecord | undefined;

  if (!keyRecord?.wrappedKey || !keyRecord?.salt) {
    throw new Error('Encryption key not found for vault. Please sync your key first.');
  }

  await sodium.ready;

  const pinBytes = sodium.crypto_pwhash(
    32,
    pin,
    keyRecord.salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );

  const wrappingKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(pinBytes),
    { name: 'AES-KW', length: 256 },
    false,
    ['unwrapKey'],
  );

  const dataKey = await crypto.subtle.unwrapKey(
    'raw',
    keyRecord.wrappedKey,
    wrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const binaryString = atob(ciphertext);
  const blob = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    blob[i] = binaryString.charCodeAt(i);
  }
  const iv = blob.slice(0, 12);
  const encryptedBytes = blob.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    dataKey,
    encryptedBytes,
  );

  return new TextDecoder().decode(decryptedBuffer);
}
