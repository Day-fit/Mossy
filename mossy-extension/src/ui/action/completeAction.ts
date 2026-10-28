import type { WrappedKeyRecord } from '../../types/vault';
import type { Action } from '../../types/models';
import type { ActionWorker } from '../../actions/ActionWorker';
import { messaging } from '../../messaging/rpc';
import { signingHandles } from '../../storage/deviceIdentity';

// Called only after unlocking. Keep plaintext scoped to the operation that needs it.
export async function completeAction({
    action,
    currentWorker,
    record,
    requireLive,
}: {
    action: Action;
    currentWorker: ActionWorker;
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
        const encrypted = await messaging.sendMessage('getActionCiphertext', {
            actionId: action.id,
        });
        const secret = await currentWorker.read({
            ciphertext: encrypted.ciphertext,
        });
        currentWorker.stop();
        requireLive();

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
    } else if (action.operation === 'save') {
        const candidate = await messaging.sendMessage('getActionCandidate', {
            actionId: action.id,
        });

        let unchanged = false;

        if (action.entry) {
            const encrypted = await messaging.sendMessage(
                'getActionCiphertext',
                {
                    actionId: action.id,
                }
            );
            const existing = await currentWorker.read({
                ciphertext: encrypted.ciphertext,
            });
            unchanged = existing === candidate;
        }

        const result = unchanged
            ? { unchanged: true as const }
            : {
                  ciphertext: await currentWorker.encrypt({
                      password: candidate,
                  }),
              };
        currentWorker.stop();
        requireLive();

        await messaging.sendMessage('finishSave', {
            actionId: action.id,
            ...result,
        });
    } else if (action.operation === 'sync-send') {
        if (!action.code || !action.receiver) {
            throw new Error('The key-sync offer is unavailable.');
        }

        const result = await currentWorker.send({
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
