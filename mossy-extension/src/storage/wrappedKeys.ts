import { scopeKey } from '../security/vaultCrypto';
import { type Scope, type WrappedKeyRecord } from '../types/vault';
import { openDatabase } from './database';

export const wrappedKeys = {
    async read(scope: Scope): Promise<WrappedKeyRecord | undefined> {
        const value = await (
            await openDatabase()
        ).get('wrapped', scopeKey(scope));

        const isInvalidWrappedKey =
            !value || !(value.wrappedKey instanceof ArrayBuffer);
        if (isInvalidWrappedKey) {
            return undefined;
        }

        const isPrfRecord =
            value.type === 'PRF' && value.credentialId instanceof ArrayBuffer;
        if (isPrfRecord) {
            return value;
        }

        const isPasswordRecord =
            value.type === 'Password' && value.salt instanceof Uint8Array;
        if (isPasswordRecord) {
            return value;
        }

        return undefined;
    },
    async write(scope: Scope, record: WrappedKeyRecord) {
        const database = await openDatabase();

        await database.put('wrapped', record, scopeKey(scope));
    },
};
