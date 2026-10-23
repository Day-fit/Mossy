import { useEffect, useRef, useState } from 'react';
import { ActionWorker } from '../../actions/ActionWorker';
import { messaging } from '../../messaging/rpc';
import type { ReceiverDetails } from 'mossy-api-client';
import { wrappedKeys } from '../../storage/wrappedKeys';
import { signingHandles } from '../../storage/deviceIdentity';
import { assertLive } from '../../security/security';
import type { Action as ActionModel, ActionResult } from '../../types/models';
import type { WrappedKeyRecord } from '../../types/vault';
import type { Phase } from './authorization';

export function useActionSession() {
    const [action, setAction] = useState<ActionModel>();
    const [method, setMethod] = useState<'PRF' | 'Password'>();
    const [phase, setPhase] = useState<Phase>('loading');
    const [message, setMessage] = useState('');
    const [code, setCode] = useState('');
    const [now, setNow] = useState(() => Date.now());

    const worker = useRef<ActionWorker | null>(null);
    const alive = useRef(true);
    const active = useRef(true);
    const completed = useRef(false);
    const password = useRef<HTMLInputElement>(null);
    const confirmation = useRef<HTMLInputElement>(null);
    const credentialId = useRef<ArrayBuffer | undefined>(undefined);
    const transfer = useRef<ActionResult | undefined>(undefined);
    const record = useRef<WrappedKeyRecord | undefined>(undefined);

    useEffect(() => {
        alive.current = true;
        active.current = true;

        const actionWorker = new ActionWorker();
        worker.current = actionWorker;
        const actionId = location.hash.slice(1);
        let deadline: number | undefined;
        const cancel = () => {
            if (!completed.current) {
                void messaging
                    .sendMessage('cancelAction', { actionId })
                    .catch(() => undefined);
            }
        };

        const fail = (error: unknown) => {
            active.current = false;

            if (completed.current) {
                return;
            }

            actionWorker.stop();
            cancel();

            if (password.current) {
                password.current.value = '';
            }

            if (confirmation.current) {
                confirmation.current.value = '';
            }

            if (alive.current) {
                setPhase('error');
                setMessage(
                    error instanceof Error
                        ? error.message
                        : 'This action ended.'
                );
            }
        };

        void messaging
            .sendMessage('claimAction', { actionId })
            .then(async (value) => {
                if (!alive.current) {
                    return;
                }

                deadline = value.deadline;
                assertLive(deadline);
                setAction(value);

                if (value.operation === 'sync-receive') {
                    setPhase('waiting');

                    const receiver = await actionWorker.call<ReceiverDetails>(
                        'offer',
                        {
                            ...(await signingHandles(value.scope.instance)),
                            deviceId: value.deviceId,
                            vaultId: value.scope.vaultId,
                        }
                    );
                    const result = await messaging.sendMessage('offerKeySync', {
                        actionId,
                        receiver,
                    });

                    if (!alive.current) {
                        return;
                    }

                    setCode(result.code);
                    transfer.current = await messaging.sendMessage(
                        'waitForKeySync',
                        {
                            actionId,
                        }
                    );

                    if (!alive.current) {
                        return;
                    }

                    assertLive(value.deadline);
                    credentialId.current = await actionWorker.call<
                        ArrayBuffer | undefined
                    >('receive', {
                        ...transfer.current,
                        context: { code: result.code, receiver },
                    });
                    transfer.current = undefined;

                    if (!alive.current) {
                        return;
                    }

                    assertLive(value.deadline);
                    setPhase('authorize');
                } else {
                    const stored = await wrappedKeys.read(value.scope);

                    if (!stored) {
                        throw new Error(
                            'This browser needs the vault key. Close this action and receive it using Sync vault keys.'
                        );
                    }

                    record.current = stored;
                    setMethod(stored.type);
                    setPhase('authorize');
                }
            })
            .catch(fail);

        const timer = setInterval(() => {
            const now = Date.now();
            setNow(now);
            if (
                deadline &&
                now >= deadline &&
                active.current &&
                !completed.current
            ) {
                fail(new Error('This action expired.'));
            }
        }, 200);

        const unload = () => {
            actionWorker.stop();
            cancel();

            if (password.current) {
                password.current.value = '';
            }

            if (confirmation.current) {
                confirmation.current.value = '';
            }
        };

        window.addEventListener('pagehide', unload);

        return () => {
            alive.current = false;
            active.current = false;
            clearInterval(timer);
            window.removeEventListener('pagehide', unload);
            actionWorker.stop();
            cancel();
            transfer.current = undefined;
            record.current = undefined;
            credentialId.current = undefined;
        };
    }, []);

    const close = () => {
        worker.current?.stop();
        active.current = false;
        if (!completed.current) {
            void messaging
                .sendMessage('cancelAction', {
                    actionId: location.hash.slice(1),
                })
                .catch(() => undefined);
        }
        window.close();
    };

    return {
        action,
        method,
        setMethod,
        phase,
        setPhase,
        message,
        setMessage,
        code,
        now,
        worker,
        alive,
        active,
        completed,
        password,
        confirmation,
        credentialId,
        transfer,
        record,
        close,
    };
}

export type ActionSession = ReturnType<typeof useActionSession>;
