import type { KeyProtection } from '../../actions/worker/types';
import { useState } from 'react';
import { VAULT_PASSWORD_MIN_LENGTH } from '../../security/vaultCrypto';
import { authorizePrf, registerPrf } from '../../security/passkeys';
import { assertLive } from '../../security/security';
import { authorizationError, type ProtectionChoice } from './authorization';
import { completeAction } from './completeAction';
import type { ActionSession } from './useActionSession';
import { messaging, type WrappedKeyPayload } from '../../messaging/rpc';
import { useVaultName } from '../shared/useVaultName';

export function useActionAuthorization(session: ActionSession) {
    const {
        action,
        method,
        setMethod,
        setPhase,
        setMessage,
        worker,
        alive,
        active,
        completed,
        password,
        confirmation,
        credentialId,
        record,
    } = session;
    const vaultName = useVaultName(action?.scope);
    const [choice, setChoice] = useState<ProtectionChoice | null>(null);
    const authorize = async () => {
        const currentWorker = worker.current;
        const cannotAuthorize = !action || !currentWorker || !method;
        if (cannotAuthorize) {
            return;
        }

        const requireLive = () => {
            const isActionClosed = !alive.current || !active.current;
            if (isActionClosed) {
                throw new Error('Action closed.');
            }

            assertLive(action.deadline);
        };

        const isSetup = action.operation === 'sync-receive';

        const needsProtectionChoice = isSetup && !choice;
        if (needsProtectionChoice) {
            return;
        }

        const isSettingVaultPassword = isSetup && method === 'Password';
        if (isSettingVaultPassword) {
            const isVaultPasswordTooShort =
                (password.current?.value.length ?? 0) <
                VAULT_PASSWORD_MIN_LENGTH;
            if (isVaultPasswordTooShort) {
                setMessage(
                    'Use at least 12 characters for your vault password.'
                );

                return;
            }

            const passwordsDoNotMatch =
                password.current?.value !== confirmation.current?.value;
            if (passwordsDoNotMatch) {
                setMessage('Passwords do not match.');

                return;
            }
        }

        setPhase('busy');
        setMessage('');

        const vaultPassword = password.current?.value ?? '';

        if (password.current) {
            password.current.value = '';
        }

        if (confirmation.current) {
            confirmation.current.value = '';
        }

        let prf: Uint8Array<ArrayBuffer> | undefined;
        let selectedCredentialId: ArrayBuffer | undefined;
        let workerStarted = false;

        const fail = (error: unknown) => {
            const retryable =
                !workerStarted &&
                alive.current &&
                active.current &&
                Date.now() < action.deadline;

            if (!retryable) {
                currentWorker.stop();
            }

            if (alive.current) {
                setPhase(retryable ? 'authorize' : 'error');
                setMessage(authorizationError(error, isSetup));
            }
        };

        try {
            requireLive();

            if (method === 'PRF') {
                const savedCredentialId =
                    record.current?.type === 'PRF'
                        ? record.current.credentialId
                        : undefined;
                const passkey =
                    choice === 'register-passkey' && isSetup
                        ? await registerPrf(
                              action.scope.instance,
                              action.scope.vaultId,
                              vaultName ?? action.scope.vaultId
                          )
                        : await authorizePrf(
                              action.scope.instance,
                              action.scope.vaultId,
                              isSetup ? credentialId.current : savedCredentialId
                          );
                prf = passkey.prf;
                selectedCredentialId = passkey.credentialId;
            } else if (!vaultPassword) {
                fail(new Error('Enter your vault password.'));
                return;
            }

            requireLive();

            if (action.operation === 'sync-receive') {
                let protection: KeyProtection;
                if (method === 'Password') {
                    protection = {
                        type: 'Password',
                        salt: crypto.getRandomValues(new Uint8Array(16)),
                    };
                } else {
                    if (!selectedCredentialId) {
                        fail(
                            new Error('The passkey credential is unavailable.')
                        );
                        return;
                    }
                    protection = {
                        type: 'PRF',
                        credentialId: selectedCredentialId,
                    };
                }
                workerStarted = true;

                const wrapped = await currentWorker.protect({
                    password: vaultPassword,
                    prf,
                    protection,
                });
                currentWorker.stop();
                prf?.fill(0);
                requireLive();

                const wrappedKey = Array.from(
                    new Uint8Array(wrapped.wrappedKey)
                );
                const value: WrappedKeyPayload =
                    wrapped.type === 'Password'
                        ? {
                              type: 'Password',
                              wrappedKey,
                              salt: Array.from(wrapped.salt),
                          }
                        : {
                              type: 'PRF',
                              wrappedKey,
                              credentialId: Array.from(
                                  new Uint8Array(wrapped.credentialId)
                              ),
                          };
                await messaging.sendMessage('finishKeySyncReceive', {
                    actionId: action.id,
                    value,
                });
            } else {
                if (!record.current) {
                    fail(new Error('The wrapped vault key is unavailable.'));
                    return;
                }
                workerStarted = true;

                await currentWorker.unlock({
                    record: record.current,
                    password: vaultPassword,
                    prf,
                    extractable: action.operation === 'sync-send',
                });
                prf?.fill(0);
                requireLive();

                await completeAction({
                    action,
                    currentWorker,
                    record: record.current,
                    requireLive,
                });
            }

            completed.current = true;

            if (alive.current) {
                setPhase('done');
                setMessage(
                    action.operation === 'sync-receive'
                        ? 'Vault key received and protected.'
                        : 'Action completed.'
                );
            }
        } catch (error) {
            fail(error);
        } finally {
            prf?.fill(0);

            if (password.current) {
                password.current.value = '';
            }

            if (workerStarted) {
                record.current = undefined;
                credentialId.current = undefined;
            }
        }
    };

    const selectChoice = (next: typeof choice) => {
        setChoice(next);

        const methods = {
            'use-password': 'Password',
            'use-passkey': 'PRF',
            'register-passkey': 'PRF',
        } as const;
        setMethod(next ? methods[next] : undefined);
        setMessage('');

        if (password.current) {
            password.current.value = '';
        }

        if (confirmation.current) {
            confirmation.current.value = '';
        }
    };

    return { choice, authorize, selectChoice };
}
