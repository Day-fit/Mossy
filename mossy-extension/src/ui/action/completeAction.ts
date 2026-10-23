import type { WrappedKeyRecord } from '../../types/vault';
import type { Action } from '../../types/models';
import type { ActionWorker } from '../../actions/ActionWorker';
import { messaging, type ActionPort } from '../../messaging/rpc';
import type { UploadVaultKeyRequest } from 'mossy-api-client';
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
    const shouldReadPassword =
        action.operation === 'copy-password' || action.operation === 'fill';

    if (action.operation === 'copy-username') {
        currentWorker.stop();

        await navigator.clipboard.writeText(action.entry!.identifier);
        await messaging.sendMessage('finishCopyUsername', {
            actionId: action.id,
        });
    } else if (shouldReadPassword) {
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
                await messaging.sendMessage('finishCopyPassword', {
                    actionId: action.id,
                });
            } else {
                await messaging.sendMessage('finishFill', {
                    actionId: action.id,
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

            const result = unchanged
                ? { unchanged: true as const }
                : {
                      ciphertext: await currentWorker.call<string>('encrypt', {
                          password: candidate,
                      }),
                  };
            currentWorker.stop();
            candidate = '';
            requireLive();

            await messaging.sendMessage('finishSave', {
                actionId: action.id,
                ...result,
            });
        } finally {
            candidate = '';
        }
    } else if (action.operation === 'sync-send') {
        const result = await currentWorker.call<UploadVaultKeyRequest>('send', {
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

        await messaging.sendMessage('finishKeySyncSend', {
            actionId: action.id,
            value: result,
        });
    }
}
