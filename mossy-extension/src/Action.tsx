import { useEffect, useRef, useState } from 'react';
import { Button } from '@mossy/ui';
import { MdVerifiedUser } from 'react-icons/md';
import { ActionWorker } from './action-lifecycle';
import { ActionPort } from './rpc';
import { authorizePrf } from './prf';
import { wrappedKeys, signingHandles } from './storage';
import { assertLive } from './security';
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
    const [action, setAction] = useState<ActionModel>();
    const [method, setMethod] = useState<'PRF' | 'Password'>();
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
                document.documentElement.dataset.theme = String(
                    (await chrome.storage.local.get('theme')).theme ?? 'system'
                );
                if (value.operation === 'sync-receive') {
                    const existing = await wrappedKeys.read(value.scope);
                    // Existing PRF protection cannot be replaced with password protection accidentally.
                    if (existing && existing.type !== value.protection)
                        throw new Error(
                            'This vault already uses a different protection method on this browser.'
                        );
                    setMethod(existing?.type ?? value.protection ?? 'PRF');
                    setPhase('waiting');
                    const receiver = await actionWorker.call('offer', {
                        ...(await signingHandles(value.scope.instance)),
                        deviceId: value.deviceId,
                        vaultId: value.scope.vault,
                    });
                    offer.current = receiver;
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
        setPhase('busy');
        setMessage('');
        let vaultPassword = password.current?.value ?? '';
        if (password.current) password.current.value = '';
        let prf: Uint8Array<ArrayBuffer> | undefined;
        try {
            requireLive();
            if (method === 'PRF')
                prf = await authorizePrf(action.scope.instance, action.userId);
            else if (!vaultPassword)
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
                        : { type: 'PRF' };
                const wrapped = await currentWorker.call<WrappedKeyRecord>(
                    'receive',
                    {
                        ...transfer.current,
                        context: {
                            code,
                            receiver: await receiverFromOffer(action),
                        },
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
                        : {}),
                });
            } else {
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
                                { ciphertext: encrypted.ciphertext }
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
            currentWorker.stop();
            if (alive.current) {
                setPhase('error');
                setMessage(
                    error instanceof Error ? error.message : 'Action failed.'
                );
            }
        } finally {
            vaultPassword = '';
            prf?.fill(0);
            if (password.current) password.current.value = '';
            record.current = undefined;
            transfer.current = undefined;
        }
    };
    // The offer contains only transport metadata; it is read from a ref, never vault keys.
    const offer = useRef<unknown>(undefined);
    async function receiverFromOffer(value: ActionModel) {
        if (offer.current) return offer.current;
        return value.receiver;
    }
    return (
        <main className="action">
            <header>
                <h1>
                    <img src="/mossy_logo.png" width="30" height="30" alt="" />
                    Mossy
                </h1>
                <MdVerifiedUser size={24} aria-hidden />
            </header>
            <h2>
                {action ? titles[action.operation] : 'Preparing secure action…'}
            </h2>
            {action && (
                <>
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
                    <p className="notice">
                        <MdVerifiedUser />
                        This authorization applies to this action only.
                    </p>
                    {action.candidateDeadline && (
                        <p role="timer">
                            Save expires in{' '}
                            {Math.max(
                                0,
                                Math.ceil(
                                    (action.candidateDeadline - now) / 1000
                                )
                            )}{' '}
                            seconds
                        </p>
                    )}
                </>
            )}
            {phase === 'loading' && (
                <p role="status">Preparing secure action…</p>
            )}
            {phase === 'waiting' && (
                <>
                    <p>
                        Open Sync on the device that holds this vault key and
                        enter this code.
                    </p>
                    {code ? (
                        <output className="code" aria-label="Receiving code">
                            {code}
                        </output>
                    ) : (
                        <p role="status">Creating a receiving code…</p>
                    )}
                    <p className="muted">
                        No vault key is unlocked while waiting. Local protection
                        is requested when the transfer arrives.
                    </p>
                </>
            )}
            {phase === 'authorize' && (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void authorize();
                    }}
                >
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
                                minLength={
                                    action?.operation === 'sync-receive'
                                        ? 12
                                        : undefined
                                }
                            />
                        </>
                    ) : (
                        <p>
                            Use your existing Mossy passkey to authorize this
                            action.
                        </p>
                    )}
                    <div className="actions">
                        <Button type="submit" padding="medium">
                            {method === 'PRF'
                                ? 'Authorize with passkey'
                                : 'Authorize action'}
                        </Button>
                    </div>
                </form>
            )}
            {phase === 'busy' && (
                <p role="status">Authorizing and completing this action…</p>
            )}
            {message && (
                <div
                    role={phase === 'error' ? 'alert' : 'status'}
                    className={`status ${phase === 'error' ? 'error' : ''}`}
                >
                    {message}
                </div>
            )}
            <div className="actions">
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
            </div>
        </main>
    );
}
