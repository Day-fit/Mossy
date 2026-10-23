import { useState } from 'react';
import { VAULT_PASSWORD_MIN_LENGTH } from '../../security/vaultCrypto';
import { type WrappedKeyRecord } from '../../types/vault';
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
        transfer,
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

        let vaultPassword = password.current?.value ?? '';

        if (password.current) {
            password.current.value = '';
        }

        if (confirmation.current) {
            confirmation.current.value = '';
        }

        let prf: Uint8Array<ArrayBuffer> | undefined;
        let selectedCredentialId: ArrayBuffer | undefined;
        let workerStarted = false;

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
                throw new Error('Enter your vault password.');
            }

            if (!alive.current) {
                throw new Error('Action closed.');
            }

            requireLive();

            if (action.operation === 'sync-receive') {
                const isVaultPasswordTooShort =
                    method === 'Password' &&
                    vaultPassword.length < VAULT_PASSWORD_MIN_LENGTH;
                if (isVaultPasswordTooShort) {
                    throw new Error(
                        'Use at least 12 characters for the vault password.'
                    );
                }

                const protection =
                    method === 'Password'
                        ? {
                              type: 'Password',
                              salt: crypto.getRandomValues(new Uint8Array(16)),
                          }
                        : { type: 'PRF', credentialId: selectedCredentialId };
                workerStarted = true;

                const wrapped = await currentWorker.call<WrappedKeyRecord>(
                    'protect',
                    {
                        password: vaultPassword,
                        prf,
                        protection,
                    }
                );
                currentWorker.stop();
                vaultPassword = '';
                prf?.fill(0);
                requireLive();

                if (!alive.current) {
                    throw new Error('Action closed.');
                }

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
                workerStarted = true;

                await currentWorker.call('unlock', {
                    record: record.current,
                    password: vaultPassword,
                    prf,
                    extractable: action.operation === 'sync-send',
                });
                vaultPassword = '';
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
        } finally {
            vaultPassword = '';
            prf?.fill(0);

            if (password.current) {
                password.current.value = '';
            }

            if (workerStarted) {
                record.current = undefined;
                transfer.current = undefined;
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
