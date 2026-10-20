import { useEffect, useRef, useState } from 'react';
import { Button } from '@mossy/ui';
import {
    MdVerifiedUser,
    MdLockOutline,
    MdFingerprint,
    MdCheckCircleOutline,
    MdErrorOutline,
} from 'react-icons/md';
import { AppHeader, LoadingState, SecurityNotice } from './components';
import { ActionWorker } from './action-lifecycle';
import { ActionPort } from './rpc';
import { authorizePrf, registerPrf } from './hooks/useEncryptionHook';
import { wrappedKeys, signingHandles } from './storage';
import { assertLive } from './security';
import { useTheme } from './theme';
import type { Action as ActionModel, ActionResult } from './models';
import type { WrappedKeyRecord } from '@mossy/client-core';
const titles = {
    'copy-password': 'Copy password',
    'copy-username': 'Copy username',
    fill: 'Fill login form',
    save: 'Save password',
    'sync-send': 'Send vault key',
    'sync-receive': 'Receive vault key',
};
export default function Action() {
    useTheme();
    const [action, setAction] = useState<ActionModel>();
    const [method, setMethod] = useState<'PRF' | 'Password'>();
    const [choice, setChoice] = useState<
        'use-passkey' | 'use-password' | 'register-passkey' | null
    >(null);
    const [phase, setPhase] = useState<
        'loading' | 'waiting' | 'authorize' | 'busy' | 'done' | 'error'
    >('loading');
    const [message, setMessage] = useState('');
    const [code, setCode] = useState('');
    const [now, setNow] = useState(Date.now());
    const worker = useRef<ActionWorker | null>(null);
    const port = useRef<ActionPort | null>(null);
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
        const fail = (error: unknown) => {
            active.current = false;
            if (completed.current) return;
            actionWorker.stop();
            if (password.current) password.current.value = '';
            if (confirmation.current) confirmation.current.value = '';
            if (alive.current) {
                setPhase('error');
                setMessage(
                    error instanceof Error
                        ? error.message
                        : 'This action ended.'
                );
            }
        };
        const connection = new ActionPort(location.hash.slice(1), () =>
            fail(new Error('This action expired or was canceled.'))
        );
        port.current = connection;
        void connection
            .call<ActionModel>('claim')
            .then(async (value) => {
                if (!alive.current) return;
                setAction(value);
                if (value.operation === 'sync-receive') {
                    setPhase('waiting');
                    const receiver = await actionWorker.call('offer', {
                        ...(await signingHandles(value.scope.instance)),
                        deviceId: value.deviceId,
                        vaultId: value.scope.vault,
                    });
                    const result = await connection.call<{ code: string }>(
                        'offer',
                        receiver
                    );
                    if (!alive.current) return;
                    setCode(result.code);
                    transfer.current =
                        await connection.call<ActionResult>('wait');
                    if (!alive.current) return;
                    assertLive(value.deadline);
                    credentialId.current = await actionWorker.call<
                        ArrayBuffer | undefined
                    >('receive', {
                        ...transfer.current,
                        context: { code: result.code, receiver },
                    });
                    transfer.current = undefined;
                    if (!alive.current) return;
                    assertLive(value.deadline);
                    setPhase('authorize');
                } else {
                    const stored = await wrappedKeys.read(value.scope);
                    if (!stored)
                        throw new Error(
                            'This browser needs the vault key. Close this action and receive it using Sync vault keys.'
                        );
                    record.current = stored;
                    setMethod(stored.type);
                    setPhase('authorize');
                }
            })
            .catch(fail);
        const timer = setInterval(() => setNow(Date.now()), 200);
        const unload = () => {
            actionWorker.stop();
            connection.close();
            if (password.current) password.current.value = '';
            if (confirmation.current) confirmation.current.value = '';
        };
        window.addEventListener('pagehide', unload);
        return () => {
            alive.current = false;
            active.current = false;
            clearInterval(timer);
            window.removeEventListener('pagehide', unload);
            actionWorker.stop();
            connection.close();
            transfer.current = undefined;
            record.current = undefined;
            credentialId.current = undefined;
        };
    }, []);
    const authorize = async () => {
        if (!action || !worker.current || !port.current || !method) return;
        const currentWorker = worker.current;
        const connection = port.current;
        const requireLive = () => {
            if (!alive.current || !active.current)
                throw new Error('Action closed.');
            assertLive(action.deadline);
        };
        const isSetup = action.operation === 'sync-receive';
        if (isSetup && !choice) return;
        if (isSetup && method === 'Password') {
            if ((password.current?.value.length ?? 0) < 12) {
                setMessage(
                    'Use at least 12 characters for your vault password.'
                );
                return;
            }
            if (password.current?.value !== confirmation.current?.value) {
                setMessage('Passwords do not match.');
                return;
            }
        }
        setPhase('busy');
        setMessage('');
        let vaultPassword = password.current?.value ?? '';
        if (password.current) password.current.value = '';
        if (confirmation.current) confirmation.current.value = '';
        let prf: Uint8Array<ArrayBuffer> | undefined;
        let selectedCredentialId: ArrayBuffer | undefined;
        let workerStarted = false;
        try {
            requireLive();
            if (method === 'PRF') {
                const passkey =
                    choice === 'register-passkey' && isSetup
                        ? await registerPrf(
                              action.scope.instance,
                              action.scope.vault,
                              action.vaultName?.trim() || action.scope.vault
                          )
                        : await authorizePrf(
                              action.scope.instance,
                              action.scope.vault,
                              isSetup
                                  ? credentialId.current
                                  : record.current?.type === 'PRF'
                                    ? record.current.credentialId
                                    : undefined
                          );
                prf = passkey.prf;
                selectedCredentialId = passkey.credentialId;
            } else if (!vaultPassword)
                throw new Error('Enter your vault password.');
            if (!alive.current) throw new Error('Action closed.');
            requireLive();
            if (action.operation === 'sync-receive') {
                if (method === 'Password' && vaultPassword.length < 12)
                    throw new Error(
                        'Use at least 12 characters for the vault password.'
                    );
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
                if (!alive.current) throw new Error('Action closed.');
                await connection.call('receive-finish', {
                    type: wrapped.type,
                    wrappedKey: Array.from(new Uint8Array(wrapped.wrappedKey)),
                    ...(wrapped.type === 'Password'
                        ? { salt: Array.from(wrapped.salt) }
                        : {
                              credentialId: Array.from(
                                  new Uint8Array(wrapped.credentialId)
                              ),
                          }),
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
                if (action.operation === 'copy-username') {
                    currentWorker.stop();
                    await navigator.clipboard.writeText(
                        action.entry!.identifier
                    );
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
                        } else
                            await connection.call('finish', {
                                password: secret,
                            });
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
                            let existing = await currentWorker.call<string>(
                                'read',
                                {
                                    ciphertext: encrypted.ciphertext,
                                }
                            );
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
                            record.current?.type === 'PRF'
                                ? record.current.credentialId
                                : undefined,
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
            if (!retryable) currentWorker.stop();
            if (alive.current) {
                setPhase(retryable ? 'authorize' : 'error');
                setMessage(
                    error instanceof DOMException &&
                        error.name === 'NotAllowedError'
                        ? isSetup
                            ? 'The passkey prompt was closed. Try again or choose another method.'
                            : 'The passkey prompt was closed. Try again.'
                        : error instanceof Error
                          ? error.message
                          : 'Action failed.'
                );
            }
        } finally {
            vaultPassword = '';
            prf?.fill(0);
            if (password.current) password.current.value = '';
            if (workerStarted) {
                record.current = undefined;
                transfer.current = undefined;
                credentialId.current = undefined;
            }
        }
    };
    const selectChoice = (next: typeof choice) => {
        setChoice(next);
        setMethod(
            next === 'use-password' ? 'Password' : next ? 'PRF' : undefined
        );
        setMessage('');
        if (password.current) password.current.value = '';
        if (confirmation.current) confirmation.current.value = '';
    };
    const AuthorizationIcon =
        phase === 'done'
            ? MdCheckCircleOutline
            : phase === 'error'
              ? MdErrorOutline
              : method === 'PRF'
                ? MdFingerprint
                : MdLockOutline;
    return (
        <main className="action">
            <AppHeader>
                <MdVerifiedUser
                    size={22}
                    className="field-icon"
                    aria-label="Secure action"
                />
            </AppHeader>
            <div className="page-content">
                <section
                    className="panel action-panel"
                    aria-labelledby="action-title"
                    aria-busy={phase === 'loading' || phase === 'busy'}
                >
                    <div className="auth-heading">
                        <span className="auth-symbol" aria-hidden="true">
                            <AuthorizationIcon size={24} />
                        </span>
                        <div>
                            <h2 id="action-title">
                                {action?.operation === 'sync-receive' &&
                                phase === 'authorize'
                                    ? 'Protect your vault'
                                    : action
                                      ? titles[action.operation]
                                      : 'Secure action'}
                            </h2>
                            <p>
                                {phase === 'done'
                                    ? 'All set. You can close this window.'
                                    : phase === 'error'
                                      ? 'This action could not be completed.'
                                      : action?.operation === 'sync-receive' &&
                                          phase === 'authorize'
                                        ? !choice
                                            ? 'Choose how to protect this vault on this browser.'
                                            : choice === 'register-passkey'
                                              ? 'Register a new passkey for this vault.'
                                              : choice === 'use-passkey'
                                                ? 'Use this vault’s existing passkey.'
                                                : 'Choose a password of at least 12 characters to protect this vault.'
                                        : 'Confirm this action with your vault.'}
                            </p>
                        </div>
                    </div>
                    {action && (
                        <>
                            <div className="action-context">
                                <p className="site">
                                    {action.candidateOrigin ??
                                        action.entry?.address ??
                                        new URL(action.scope.instance).hostname}
                                </p>
                                {(action.entry?.identifier ||
                                    action.candidateIdentifier) && (
                                    <p>
                                        {action.entry?.identifier ??
                                            action.candidateIdentifier}
                                    </p>
                                )}
                            </div>
                            {action.candidateDeadline &&
                                phase !== 'done' &&
                                phase !== 'error' && (
                                    <p className="expiry" role="timer">
                                        Save expires in{' '}
                                        {Math.max(
                                            0,
                                            Math.ceil(
                                                (action.candidateDeadline -
                                                    now) /
                                                    1000
                                            )
                                        )}{' '}
                                        seconds
                                    </p>
                                )}
                        </>
                    )}
                    {phase === 'loading' && (
                        <LoadingState>Preparing secure action…</LoadingState>
                    )}
                    {phase === 'waiting' && (
                        <>
                            <p>
                                Open Sync on the device that holds this vault
                                key and enter this code.
                            </p>
                            {code ? (
                                <output
                                    className="code"
                                    aria-label="Receiving code"
                                >
                                    {code}
                                </output>
                            ) : (
                                <LoadingState>
                                    Creating a receiving code…
                                </LoadingState>
                            )}
                            <p className="muted">
                                Local protection is requested after the transfer
                                is received and verified.
                            </p>
                        </>
                    )}
                    {phase === 'authorize' && (
                        <form
                            id="authorize-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void authorize();
                            }}
                        >
                            {action?.operation === 'sync-receive' &&
                                !choice && (
                                    <div
                                        role="group"
                                        aria-label="Vault protection method"
                                        className="protection-choices"
                                    >
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                typeof PublicKeyCredential ===
                                                'undefined'
                                            }
                                            onClick={() =>
                                                selectChoice('use-passkey')
                                            }
                                        >
                                            Use existing passkey
                                        </Button>
                                        <p className="muted">
                                            Select the passkey already
                                            registered for this vault.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                selectChoice('use-password')
                                            }
                                        >
                                            Use password
                                        </Button>
                                        <p className="muted">
                                            Set a vault password on this
                                            browser.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                typeof PublicKeyCredential ===
                                                'undefined'
                                            }
                                            onClick={() =>
                                                selectChoice('register-passkey')
                                            }
                                        >
                                            Register new passkey
                                        </Button>
                                        <p className="muted">
                                            Create a passkey for this vault.
                                        </p>
                                    </div>
                                )}
                            {action?.operation === 'sync-receive' &&
                                choice === 'register-passkey' && (
                                    <div className="status">
                                        <div>
                                            <strong>
                                                This may replace an existing
                                                passkey
                                            </strong>
                                            <p>
                                                Replacing this vault’s passkey
                                                can prevent other browsers or
                                                devices from unlocking copies of
                                                this vault that use the old
                                                passkey.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            {method === 'Password' ? (
                                <>
                                    <label htmlFor="vault-password">
                                        {action?.operation === 'sync-receive'
                                            ? 'Protect with a vault password'
                                            : 'Vault password'}
                                    </label>
                                    <input
                                        ref={password}
                                        id="vault-password"
                                        type="password"
                                        required
                                        autoComplete="off"
                                        autoFocus
                                        aria-describedby="vault-password-hint"
                                        minLength={
                                            action?.operation === 'sync-receive'
                                                ? 12
                                                : undefined
                                        }
                                    />
                                    <p
                                        id="vault-password-hint"
                                        className="muted field-hint"
                                    >
                                        {action?.operation === 'sync-receive'
                                            ? 'Use at least 12 characters to protect this vault on this browser.'
                                            : 'Use your vault password to authorize this action.'}
                                    </p>
                                    {action?.operation === 'sync-receive' && (
                                        <>
                                            <label htmlFor="vault-password-confirmation">
                                                Confirm vault password
                                            </label>
                                            <input
                                                ref={confirmation}
                                                id="vault-password-confirmation"
                                                type="password"
                                                required
                                                autoComplete="off"
                                            />
                                        </>
                                    )}
                                </>
                            ) : method === 'PRF' ? (
                                <div className="passkey-prompt">
                                    <MdFingerprint
                                        size={22}
                                        aria-hidden="true"
                                    />
                                    <p>
                                        {choice === 'register-passkey'
                                            ? 'This passkey will protect only this vault.'
                                            : 'Select the existing passkey for this vault.'}
                                    </p>
                                </div>
                            ) : null}
                            {action?.operation === 'sync-receive' && choice && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => selectChoice(null)}
                                >
                                    Choose another method
                                </Button>
                            )}
                        </form>
                    )}
                    {phase === 'busy' && (
                        <LoadingState>
                            Authorizing and completing this action…
                        </LoadingState>
                    )}
                    {message && (
                        <div
                            role={phase === 'done' ? 'status' : 'alert'}
                            className={`status ${phase === 'done' ? 'success' : 'error'}`}
                        >
                            {phase !== 'done' ? (
                                <MdErrorOutline size={18} aria-hidden="true" />
                            ) : (
                                <MdCheckCircleOutline
                                    size={18}
                                    aria-hidden="true"
                                />
                            )}
                            <span>{message}</span>
                        </div>
                    )}
                    <div className="action-footer">
                        <Button
                            variant="outline"
                            padding="medium"
                            onClick={() => {
                                worker.current?.stop();
                                port.current?.close();
                                window.close();
                            }}
                        >
                            {phase === 'done' ? 'Close' : 'Cancel'}
                        </Button>
                        {phase === 'authorize' && method && (
                            <Button
                                type="submit"
                                form="authorize-form"
                                padding="medium"
                            >
                                {action?.operation === 'sync-receive'
                                    ? choice === 'register-passkey'
                                        ? 'Register new passkey'
                                        : choice === 'use-passkey'
                                          ? 'Use existing passkey'
                                          : 'Save password'
                                    : method === 'PRF'
                                      ? 'Authorize with passkey'
                                      : 'Authorize action'}
                            </Button>
                        )}
                    </div>
                </section>
                <SecurityNotice>
                    This authorization applies to this action only.
                </SecurityNotice>
            </div>
        </main>
    );
}
