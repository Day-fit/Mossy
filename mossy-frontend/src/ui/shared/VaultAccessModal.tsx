import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MdErrorOutline, MdFingerprint, MdLockOutline } from 'react-icons/md';
import {
    VAULT_PASSWORD_MIN_LENGTH,
    useEncryptionHook,
    type PreparedProtection,
    type VaultKeyMetadata,
    type VaultKeySetup,
} from '../../hooks/useEncryptionHook.ts';
import Button from './Button.tsx';
import { useVaultStore } from '../../store/vaultStore.ts';

type VaultAccessModalProps = {
    vaultId: string;
    vaultName?: string;
    onClose: () => void;
} & (
    | { mode: 'register' | 'unlock'; onSuccess?: () => void }
    | { mode: 'prepare'; credentialId?: ArrayBuffer; onPrepared: (protection: PreparedProtection) => void }
);

type AccessChoice = 'use-passkey' | 'use-password' | 'register-passkey';

export default function VaultAccessModal(props: VaultAccessModalProps) {
    const { vaultId, mode, onClose } = props;
    const storedVaultName = useVaultStore((state) =>
        state.vaults.find((vault) => vault.vaultId === vaultId)?.vaultName
    );
    const vaultName = props.vaultName?.trim() || storedVaultName?.trim() || vaultId;
    const { getKeyMetadata, prepareProtection, registerVaultKey, unlockVault } =
        useEncryptionHook();
    const [metadata, setMetadata] = useState<VaultKeyMetadata | null>(null);
    const [choice, setChoice] = useState<AccessChoice | null>(
        mode === 'register'
            ? typeof PublicKeyCredential !== 'undefined'
                ? 'register-passkey'
                : 'use-password'
            : null
    );
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const reducedMotion = useReducedMotion();
    const titleId = useId();
    const descriptionId = useId();
    const errorId = useId();
    const passwordId = useId();
    const confirmationId = useId();
    const passwordHintId = useId();
    const isSetup = mode !== 'unlock';
    const showPassword = isSetup
        ? choice === 'use-password'
        : metadata?.type === 'Password';
    const isPasskey = isSetup
        ? choice === 'use-passkey' || choice === 'register-passkey'
        : metadata?.type === 'PRF';

    useEffect(() => {
        const previousFocus = document.activeElement;
        formRef.current?.focus();
        return () => {
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, []);

    useEffect(() => {
        if (showPassword) formRef.current?.querySelector('input')?.focus();
    }, [showPassword]);

    function selectChoice(nextChoice: AccessChoice | null) {
        setChoice(nextChoice);
        setError(null);
        setPassword('');
        setConfirmation('');
    }

    useEffect(() => {
        if (mode !== 'unlock') return;
        let active = true;
        async function load() {
            try {
                const value = await getKeyMetadata(vaultId);
                if (active) setMetadata(value);
            } catch (reason) {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Could not load the vault key.'
                    );
            }
        }
        void load();
        return () => {
            active = false;
        };
    }, [getKeyMetadata, mode, vaultId]);

    async function submit(event?: SubmitEvent<HTMLFormElement>) {
        event?.preventDefault();
        if (busy || (isSetup ? !choice : !metadata)) return;
        if (showPassword && isSetup) {
            if (password.length < VAULT_PASSWORD_MIN_LENGTH) {
                setError('Use at least 12 characters for your vault password.');
                return;
            }
            if (password !== confirmation) {
                setError('Passwords do not match.');
                return;
            }
        }

        setBusy(true);
        setError(null);
        try {
            if (props.mode === 'unlock') {
                await unlockVault(vaultId, password);
                onClose();
                props.onSuccess?.();
                return;
            }
            const setup: VaultKeySetup =
                isPasskey
                    ? {
                        type: 'PRF',
                        createNew: choice === 'register-passkey',
                        credentialId: props.mode === 'prepare' && choice === 'use-passkey'
                            ? props.credentialId
                            : undefined,
                    }
                    : { type: 'Password', password };
            const protection = await prepareProtection(vaultId, vaultName, setup);
            if (props.mode === 'prepare') {
                props.onPrepared(protection);
                return;
            }
            await registerVaultKey(vaultId, protection);
            onClose();
            props.onSuccess?.();
        } catch (reason) {
            setError(
                isPasskey && reason instanceof DOMException &&
                reason.name === 'NotAllowedError'
                    ? mode === 'prepare'
                        ? 'The passkey prompt was closed. Try again or choose another method.'
                        : mode === 'register'
                          ? 'The passkey prompt was closed. Try again or use a password.'
                          : 'The passkey prompt was closed. Try again.'
                    : reason instanceof Error
                      ? reason.message
                      : 'Could not access the vault.'
            );
        } finally {
            setBusy(false);
        }
    }

    const description = mode === 'prepare' && !choice
        ? 'Choose how to protect this vault on this browser.'
        : isSetup
          ? choice === 'register-passkey'
              ? 'Register a new passkey for this vault.'
              : choice === 'use-passkey'
                ? 'Use this vault’s existing passkey.'
                : 'Choose a password of at least 12 characters to protect this vault.'
          : !metadata
            ? 'Loading vault protection…'
            : isPasskey
              ? 'Confirm with your device to unlock your vault.'
              : 'Enter your vault password to continue.';
    const primaryLabel = busy
        ? isSetup
            ? 'Saving…'
            : 'Unlocking…'
        : mode === 'unlock'
          ? 'Unlock vault'
          : choice === 'register-passkey'
            ? 'Register new passkey'
            : choice === 'use-passkey'
              ? 'Use existing passkey'
              : 'Save password';
    const Icon = isPasskey ? MdFingerprint : MdLockOutline;

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-overlay p-4"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => {
                if (!busy && event.target === event.currentTarget) onClose();
            }}
        >
            <motion.form
                ref={formRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-busy={busy}
                onSubmit={(event) => void submit(event)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        if (!busy) onClose();
                    }
                    if (event.key === 'Tab') {
                        const controls = Array.from(
                            event.currentTarget.querySelectorAll<HTMLElement>(
                                'button:not(:disabled), input:not(:disabled)'
                            )
                        );
                        const first = controls[0];
                        const last = controls[controls.length - 1];
                        if (!first) {
                            event.preventDefault();
                        } else if (
                            event.shiftKey &&
                            !controls.includes(
                                document.activeElement as HTMLElement
                            )
                        ) {
                            event.preventDefault();
                            last.focus();
                        } else if (
                            event.shiftKey &&
                            document.activeElement === first
                        ) {
                            event.preventDefault();
                            last.focus();
                        } else if (
                            !event.shiftKey &&
                            document.activeElement === last
                        ) {
                            event.preventDefault();
                            first.focus();
                        }
                    }
                }}
                initial={
                    reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-6 text-fg-primary shadow-modal outline-none"
            >
                <header className="mb-6 flex items-start gap-3">
                    <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-fg-brand"
                        aria-hidden="true"
                    >
                        <Icon size={23} />
                    </span>
                    <div>
                        <h2
                            id={titleId}
                            className="text-2xl leading-tight outline-none"
                        >
                            {isSetup ? 'Protect your vault' : 'Unlock your vault'}
                        </h2>
                        <p
                            id={descriptionId}
                            className="mt-2 text-sm leading-6 text-fg-muted"
                        >
                            {description}
                        </p>
                    </div>
                </header>

                <div className="space-y-5">
                    {mode === 'prepare' && !choice && (
                        <div role="group" className="space-y-3" aria-label="Vault protection method">
                            <button
                                type="button"
                                disabled={busy || typeof PublicKeyCredential === 'undefined'}
                                onClick={() => selectChoice('use-passkey')}
                                className="min-h-14 w-full rounded-lg border border-border bg-surface-subtle p-4 text-left text-sm font-semibold text-fg-primary disabled:opacity-50"
                            >
                                Use existing passkey
                                <span className="mt-1 block font-normal text-fg-muted">
                                    Select the passkey already registered for this vault.
                                </span>
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => selectChoice('use-password')}
                                className="min-h-14 w-full rounded-lg border border-border bg-surface-subtle p-4 text-left text-sm font-semibold text-fg-primary"
                            >
                                Use password
                                <span className="mt-1 block font-normal text-fg-muted">
                                    Set a vault password on this browser.
                                </span>
                            </button>
                            <button
                                type="button"
                                disabled={busy || typeof PublicKeyCredential === 'undefined'}
                                onClick={() => selectChoice('register-passkey')}
                                className="min-h-14 w-full rounded-lg border border-border bg-surface-subtle p-4 text-left text-sm font-semibold text-fg-primary disabled:opacity-50"
                            >
                                Register new passkey
                                <span className="mt-1 block font-normal text-fg-muted">
                                    Create a passkey for this vault.
                                </span>
                            </button>
                        </div>
                    )}
                    {isSetup && isPasskey && (
                        <div className="rounded-lg border border-border bg-surface-subtle p-4">
                            <p className="text-sm font-semibold text-fg-secondary">
                                {choice === 'register-passkey'
                                    ? 'Register this vault’s passkey'
                                    : 'Use this vault’s passkey'}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                {choice === 'register-passkey'
                                    ? 'This passkey will protect only this vault.'
                                    : 'Select the existing passkey for this vault.'}
                            </p>
                            {mode === 'register' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => selectChoice('use-password')}
                                    className="mt-3 rounded-sm text-sm font-semibold text-fg-brand underline"
                                >
                                    Use a password instead
                                </button>
                            )}
                        </div>
                    )}
                    {mode === 'prepare' && choice === 'register-passkey' && (
                        <div className="border-l-2 border-fg-warning pl-4">
                            <p className="text-sm font-semibold text-fg-primary">
                                This may replace an existing passkey
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                Replacing this vault’s passkey can prevent other
                                browsers or devices from unlocking copies of this
                                vault that use the old passkey.
                            </p>
                        </div>
                    )}
                    {isPasskey && !isSetup && (
                        <div className="rounded-lg border border-border bg-surface-subtle p-4">
                            <p className="text-sm font-semibold text-fg-secondary">
                                Unlock with your device
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                Confirm with your Mossy passkey to continue.
                            </p>
                        </div>
                    )}
                    {showPassword && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label
                                    htmlFor={passwordId}
                                    className="block text-xs font-semibold text-fg-secondary"
                                >
                                    Vault password
                                </label>
                                <input
                                    id={passwordId}
                                    name="password"
                                    type="password"
                                    autoComplete={
                                        isSetup
                                            ? 'new-password'
                                            : 'current-password'
                                    }
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    minLength={
                                        isSetup
                                            ? VAULT_PASSWORD_MIN_LENGTH
                                            : undefined
                                    }
                                    aria-describedby={
                                        isSetup
                                            ? passwordHintId
                                            : error
                                              ? errorId
                                              : undefined
                                    }
                                    aria-invalid={error ? true : undefined}
                                    required
                                    disabled={busy}
                                    className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm"
                                />
                                {isSetup && (
                                    <p
                                        id={passwordHintId}
                                        className="text-xs text-fg-muted"
                                    >
                                        At least {VAULT_PASSWORD_MIN_LENGTH}{' '}
                                        characters.
                                    </p>
                                )}
                            </div>
                            {isSetup && (
                                <div className="space-y-2">
                                    <label
                                        htmlFor={confirmationId}
                                        className="block text-xs font-semibold text-fg-secondary"
                                    >
                                        Confirm vault password
                                    </label>
                                    <input
                                        id={confirmationId}
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirmation}
                                        onChange={(event) =>
                                            setConfirmation(event.target.value)
                                        }
                                        aria-describedby={
                                            error ? errorId : undefined
                                        }
                                        aria-invalid={error ? true : undefined}
                                        required
                                        disabled={busy}
                                        className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm"
                                    />
                                </div>
                            )}
                            {mode === 'register' && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => selectChoice('register-passkey')}
                                    className="rounded-sm text-sm font-semibold text-fg-brand underline"
                                >
                                    Use a passkey instead
                                </button>
                            )}
                        </div>
                    )}

                    {mode === 'prepare' && choice && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => selectChoice(null)}
                            className="rounded-sm text-sm font-semibold text-fg-brand underline"
                        >
                            Choose another method
                        </button>
                    )}
                    {error && (
                        <div
                            id={errorId}
                            role="alert"
                            className="flex items-start gap-2 rounded-md border border-fg-danger/20 bg-fg-danger/5 p-3 text-sm leading-6 text-fg-danger"
                        >
                            <MdErrorOutline
                                size={18}
                                className="mt-0.5 shrink-0"
                                aria-hidden="true"
                            />
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                <footer className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        padding="medium"
                        onClick={onClose}
                        disabled={busy}
                        className="min-h-10 whitespace-nowrap text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </Button>
                    {(mode === 'unlock' ? Boolean(metadata) : Boolean(choice)) && (
                        <Button
                            type="submit"
                            padding="medium"
                            disabled={busy}
                            className="min-h-10 whitespace-nowrap text-sm disabled:cursor-wait disabled:opacity-60"
                        >
                            {primaryLabel}
                        </Button>
                    )}
                </footer>
            </motion.form>
        </motion.div>
    );
}
