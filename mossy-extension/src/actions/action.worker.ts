import { expose } from 'comlink';
import { unlock, read, encrypt, clearVaultKey } from './worker/vault';
import {
    offer,
    send,
    receive,
    protect,
    clearTransferKeys,
} from './worker/keySync';
import type { ActionWorkerApi } from './worker/types';

// One worker per action. Never expose internal key access or cleanup helpers.
const api: ActionWorkerApi = {
    unlock: guard(unlock),
    read: guard(read),
    encrypt: guard(encrypt),
    offer: guard(offer),
    send: guard(send),
    receive: guard(receive),
    protect: guard(protect),
};

expose(api);

function guard<Input extends object, Output>(
    operation: (input: Input) => Promise<Output>
): (input: Input) => Promise<Output> {
    return async (input) => {
        try {
            return await operation(input);
        } catch {
            clearVaultKey();
            clearTransferKeys();
            throw new Error(
                'The secret action failed. Check your vault password or passkey, and try again.'
            );
        } finally {
            if ('password' in input) input.password = '';
            if ('prf' in input && input.prf instanceof Uint8Array)
                input.prf.fill(0);
        }
    };
}
