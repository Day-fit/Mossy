import type { WrappedKeyRecord } from '@mossy/client-core';
import type { Action } from '../../types/models';
import type { ActionWorker } from '../../actions/ActionWorker';
import type { ActionPort } from '../../messaging/rpc';
import { signingHandles } from '../../storage/deviceIdentity';

// Called only after unlocking. Keep plaintext scoped to the operation that needs it.
export async function completeAction({
    action,
    currentWorker,
    connection,
    record,
    requireLive,
}: {
    action: Action;
    currentWorker: ActionWorker;
    connection: ActionPort;
    record: WrappedKeyRecord | undefined;
    requireLive: () => void;
}) {
    if (action.operation === 'copy-username') {
        currentWorker.stop();

        await navigator.clipboard.writeText(action.entry!.identifier);
        await connection.call('finish');
    } else if (
        action.operation === 'copy-password' ||
        action.operation === 'fill'
    ) {
        const encrypted = await connection.call<{
            ciphertext: string;
        }>('ciphertext');
        let secret = await currentWorker.call<string>('read', {
            ciphertext: encrypted.ciphertext,
        });
        currentWorker.stop();
        requireLive();

        try {
            if (action.operation === 'copy-password') {
                await navigator.clipboard.writeText(secret);
                await connection.call('finish');
            } else {
                await connection.call('finish', {
                    password: secret,
                });
            }
        } finally {
            secret = '';
        }
    } else if (action.operation === 'save') {
        let candidate = await connection.call<string>('candidate');

        try {
            let unchanged = false;

            if (action.entry) {
                const encrypted = await connection.call<{
                    ciphertext: string;
                }>('ciphertext');
                let existing = await currentWorker.call<string>('read', {
                    ciphertext: encrypted.ciphertext,
                });
                unchanged = existing === candidate;
                existing = '';
            }

            const ciphertext = unchanged
                ? undefined
                : await currentWorker.call<string>('encrypt', {
                      password: candidate,
                  });
            currentWorker.stop();
            candidate = '';
            requireLive();

            await connection.call('finish', {
                ciphertext,
                unchanged,
            });
        } finally {
            candidate = '';
        }
    } else if (action.operation === 'sync-send') {
        const result = await currentWorker.call('send', {
            credentialId:
                record?.type === 'PRF' ? record.credentialId : undefined,
            ...(await signingHandles(action.scope.instance)),
            deviceId: action.deviceId,
            context: {
                code: action.code,
                receiver: action.receiver,
            },
        });
        currentWorker.stop();
        requireLive();

        await connection.call('finish', result);
    }
}
