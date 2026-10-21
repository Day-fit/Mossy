import { scopeKey } from '../security/vaultCrypto';
import { type Scope, type WrappedKeyRecord } from '../types/vault';
import { openDatabase } from './database';

export const wrappedKeys = {
    async read(scope: Scope): Promise<WrappedKeyRecord | undefined> {
        const value = await (
            await openDatabase()
        ).get('wrapped', scopeKey(scope));

        if (!value || !(value.wrappedKey instanceof ArrayBuffer)) {
            return undefined;
        }

        if (value.type === 'PRF' && value.credentialId instanceof ArrayBuffer) {
            return value;
        }

        if (value.type === 'Password' && value.salt instanceof Uint8Array) {
            return value;
        }

        return undefined;
    },
    async write(
        scope: Scope,
        record: WrappedKeyRecord,
        guard: () => void = () => {}
    ) {
        const database = await openDatabase();
        guard();

        await database.put('wrapped', record, scopeKey(scope));
    },
};
