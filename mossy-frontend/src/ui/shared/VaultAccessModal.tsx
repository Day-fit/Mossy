import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MdErrorOutline, MdFingerprint, MdLockOutline } from 'react-icons/md';
import {
    VAULT_PASSWORD_MIN_LENGTH,
    PrfNotSupportedError,
    useEncryptionHook,
    type PreparedProtection,
    type VaultKeyMetadata,
    type VaultMethod,
    type VaultKeySetup,
} from '../../hooks/useEncryptionHook.ts';
import Button from './Button.tsx';

type VaultAccessModalProps = {
    vaultId: string;
    onClose: () => void;
} & (
    | { mode: 'register' | 'unlock'; onSuccess?: () => void }
    | { mode: 'prepare'; onPrepared: (protection: PreparedProtection) => void }
);

export default function VaultAccessModal(props: VaultAccessModalProps) {
    const { vaultId, mode, onClose } = props;
    const { getKeyMetadata, prepareProtection, registerVaultKey, unlockVault } =
        useEncryptionHook();
    const [metadata, setMetadata] = useState<VaultKeyMetadata | null>(null);
    const [method, setMethod] = useState<VaultMethod>(
        typeof PublicKeyCredential !== 'undefined' ? 'PRF' : 'Password'
    );
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [passkeyNotSelected, setPasskeyNotSelected] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const reducedMotion = useReducedMotion();
    const titleId = useId();
    const descriptionId = useId();
    const errorId = useId();
    const passwordId = useId();
    const confirmationId = useId();
    const passwordHintId = useId();
    const isSetup = mode !== 'unlock';
    const showPassword = isSetup
        ? method === 'Password'
        : metadata?.type === 'Password';
    const isPasskey = isSetup ? method === 'PRF' : metadata?.type === 'PRF';

    useEffect(() => {
        const previousFocus = document.activeElement;
        formRef.current?.focus();
        return () => {
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, []);

    useEffect(() => {
        if (passkeyNotSelected && !busy) titleRef.current?.focus();
    }, [passkeyNotSelected, busy]);

    useEffect(() => {
        if (showPassword) formRef.current?.querySelector('input')?.focus();
    }, [showPassword]);

    function changeMethod(nextMethod: VaultMethod) {
        setMethod(nextMethod);
        setPasskeyNotSelected(false);
        setError(null);
        setNotice(null);
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

    async function submit(
        event?: FormEvent<HTMLFormElement>,
        createNew = false
    ) {
        event?.preventDefault();
        if (busy || (!isSetup && !metadata)) return;
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
        setNotice(null);
        try {
            if (props.mode === 'unlock') {
                await unlockVault(vaultId, password);
                onClose();
                props.onSuccess?.();
                return;
            }
            const setup: VaultKeySetup =
                method === 'PRF'
                    ? { type: 'PRF', createNew }
                    : { type: 'Password', password };
            const protection = await prepareProtection(setup);
            if (props.mode === 'prepare') {
                props.onPrepared(protection);
                return;
            }
            await registerVaultKey(vaultId, protection);
            onClose();
            props.onSuccess?.();
        } catch (reason) {
            if (
                isPasskey &&
                reason instanceof DOMException &&
                reason.name === 'NotAllowedError'
            ) {
                setPasskeyNotSelected(true);
            } else if (isSetup && reason instanceof PrfNotSupportedError) {
                setPasskeyNotSelected(false);
                setMethod('Password');
                setNotice(reason.message);
            } else {
                setError(
                    reason instanceof Error
                        ? reason.message
                        : 'Could not access the vault.'
                );
            }
        } finally {
            setBusy(false);
        }
    }

    const description = passkeyNotSelected
        ? 'Passkey selection was canceled or timed out. You can try again.'
        : isSetup
          ? isPasskey
              ? 'Use your existing Mossy passkey to protect this vault.'
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
        : passkeyNotSelected
          ? 'Try passkey again'
          : isSetup
            ? isPasskey
                ? 'Use passkey'
                : 'Save password'
            : 'Unlock vault';
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
                            ref={titleRef}
                            tabIndex={-1}
                            id={titleId}
                            className="text-2xl leading-tight outline-none"
                        >
                            {passkeyNotSelected
                                ? 'No passkey selected'
                                : isSetup
                                  ? 'Protect your vault'
                                  : 'Unlock your vault'}
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
                    {isSetup && isPasskey && (
                        <div className="rounded-lg border border-border bg-surface-subtle p-4">
                            <p className="text-sm font-semibold text-fg-secondary">
                                {passkeyNotSelected
                                    ? 'Keep using your existing passkey'
                                    : 'Unlock with your device'}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                {passkeyNotSelected
                                    ? 'If you already have a Mossy passkey, try selecting it again or choose another device in the passkey prompt.'
                                    : 'We’ll use your Mossy passkey for this vault.'}
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => changeMethod('Password')}
                                className="mt-3 rounded-sm text-sm font-semibold text-fg-brand underline"
                            >
                                Use a password instead
                            </button>
                        </div>
                    )}
                    {isSetup && isPasskey && passkeyNotSelected && (
                        <div className="border-l-2 border-fg-warning pl-4">
                            <p className="text-sm font-semibold text-fg-primary">
                                Creating a new passkey?
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                A new passkey may overwrite your existing Mossy
                                passkey and prevent access to vaults protected
                                by it. Only continue if you need a new passkey.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                padding="medium"
                                disabled={busy}
                                onClick={() => void submit(undefined, true)}
                                className="mt-3 min-h-11 text-sm disabled:cursor-wait disabled:opacity-60"
                            >
                                Create new passkey
                            </Button>
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
                            {isSetup && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => changeMethod('PRF')}
                                    className="rounded-sm text-sm font-semibold text-fg-brand underline"
                                >
                                    Use a passkey instead
                                </button>
                            )}
                        </div>
                    )}

                    {notice && (
                        <p
                            role="status"
                            className="text-sm leading-6 text-fg-muted"
                        >
                            {notice}
                        </p>
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
                    <Button
                        type="submit"
                        padding="medium"
                        disabled={busy || (mode === 'unlock' && !metadata)}
                        className="min-h-10 whitespace-nowrap text-sm disabled:cursor-wait disabled:opacity-60"
                    >
                        {primaryLabel}
                    </Button>
                </footer>
            </motion.form>
        </motion.div>
    );
}
