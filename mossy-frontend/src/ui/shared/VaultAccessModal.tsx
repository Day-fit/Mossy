import {
    useEffect,
    useEffectEvent,
    useId,
    useRef,
    useState,
    type KeyboardEvent,
    type SubmitEvent,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MdErrorOutline, MdFingerprint, MdLockOutline } from 'react-icons/md';
import {
    PrfNotSupportedError,
    supportsPasskeys,
    useVaultAccess,
    VAULT_PASSWORD_MIN_LENGTH,
} from '../../hooks/useVaultAccess.ts';
import type {
    VaultKeyMetadata,
    VaultKeyProtection,
} from '../../types/vaultKey.ts';
import { useAuthStore } from '../../store/authStore.ts';
import Button from './Button.tsx';

type VaultAccessModalProps = {
    vaultId: string;
    onClose: () => void;
} & (
    | { mode: 'register' | 'unlock'; onSuccess?: () => void }
    | { mode: 'prepare'; onPrepared: (protection: VaultKeyProtection) => void }
);

export default function VaultAccessModal(props: VaultAccessModalProps) {
    const userId = useAuthStore((state) => state.userDetails?.userId);

    return (
        <VaultAccessDialog
            key={`${userId}:${props.vaultId}:${props.mode}`}
            {...props}
        />
    );
}

function VaultAccessDialog(props: VaultAccessModalProps) {
    const { vaultId, onClose, mode } = props;
    const reducedMotion = useReducedMotion();

    const { getKeyMetadata, registerVaultKey, unlockVault, prepareProtection } =
        useVaultAccess();

    const [metadata, setMetadata] = useState<VaultKeyMetadata | null>(null);
    const [lookupAttempt, setLookupAttempt] = useState(0);
    const [method, setMethod] = useState<'PRF' | 'Text'>(() =>
        supportsPasskeys() ? 'PRF' : 'Text'
    );

    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');

    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const request = useRef<AbortController | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const passwordId = useId();
    const passwordHintId = useId();
    const confirmationId = useId();
    const errorId = useId();

    const isSetup = mode !== 'unlock';
    const showPassword = isSetup
        ? method === 'Text'
        : metadata?.type === 'Text';
    const isPasskeyUnlock = !isSetup && metadata?.type === 'PRF';
    const canDismiss = !isBusy || !isSetup;

    async function accessVault() {
        if (request.current) return;

        const controller = new AbortController();
        request.current = controller;
        setError(null);
        setIsBusy(true);

        try {
            if (mode === 'unlock') {
                await unlockVault(vaultId, password, controller.signal);
            } else {
                const setup =
                    method === 'PRF'
                        ? { type: 'PRF' as const }
                        : { type: 'Text' as const, password };

                if (mode === 'prepare') {
                    const protection = await prepareProtection(
                        vaultId,
                        setup,
                        controller.signal
                    );

                    if (!controller.signal.aborted)
                        props.onPrepared(protection);
                    return;
                }

                await registerVaultKey(vaultId, setup, controller.signal);
            }

            if (controller.signal.aborted) return;

            onClose();
            props.onSuccess?.();
        } catch (reason) {
            if (controller.signal.aborted) return;

            if (isSetup && reason instanceof PrfNotSupportedError) {
                setMethod('Text');
                setNotice(reason.message);
            } else {
                setError(
                    reason instanceof Error
                        ? reason.message
                        : 'Could not access the vault.'
                );
            }
        } finally {
            if (request.current === controller) request.current = null;
            if (!controller.signal.aborted) setIsBusy(false);
        }
    }

    const unlockSavedPasskey = useEffectEvent(() => {
        void accessVault();
    });

    useEffect(() => {
        if (mode !== 'unlock') return;

        let disposed = false;

        void getKeyMetadata(vaultId).then(
            (value) => {
                if (disposed) return;

                setMetadata(value);

                if (value.type === 'PRF') unlockSavedPasskey();
            },
            (reason: unknown) => {
                if (!disposed) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Could not load the vault key.'
                    );
                }
            }
        );

        return () => {
            disposed = true;
        };
    }, [getKeyMetadata, lookupAttempt, mode, vaultId]);

    useEffect(() => {
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        const initialFocus =
            formRef.current?.querySelector('input') ?? formRef.current;

        initialFocus?.focus();
        document.body.style.overflow = 'hidden';

        return () => {
            request.current?.abort();
            document.body.style.overflow = previousOverflow;

            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, []);

    function dismiss() {
        if (!canDismiss) return;

        request.current?.abort();
        onClose();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            dismiss();
            return;
        }

        if (event.key !== 'Tab') return;

        const controls = formRef.current?.querySelectorAll<HTMLElement>(
            'input:not(:disabled), button:not(:disabled)'
        );
        if (!controls?.length) return;

        const first = controls[0];
        const last = controls[controls.length - 1];

        if (
            event.shiftKey &&
            (document.activeElement === first ||
                document.activeElement === formRef.current)
        ) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (request.current) return;

        if (!isSetup && !metadata) {
            setError(null);
            setLookupAttempt((attempt) => attempt + 1);
            return;
        }

        if (isSetup && showPassword && password !== confirmation) {
            setError('Passwords do not match.');
            return;
        }

        void accessVault();
    }

    const description = isSetup
        ? 'Choose how to unlock this vault on this device.'
        : showPassword
          ? 'Enter your vault password to continue.'
          : 'Confirm with your device to unlock your vault.';
    const Icon =
        isPasskeyUnlock || (isSetup && method === 'PRF')
            ? MdFingerprint
            : MdLockOutline;
    const primaryLabel = isBusy
        ? isSetup
            ? 'Saving…'
            : 'Unlocking…'
        : isSetup
          ? method === 'PRF'
              ? 'Use passkey'
              : 'Save password'
          : isPasskeyUnlock || !metadata
            ? 'Try again'
            : 'Unlock vault';

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-overlay p-4"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => {
                if (event.target === event.currentTarget) dismiss();
            }}
        >
            <motion.form
                ref={formRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-busy={isBusy}
                tabIndex={-1}
                onSubmit={handleSubmit}
                onKeyDown={handleKeyDown}
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
                        <h2 id={titleId} className="text-2xl leading-tight">
                            {isSetup
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
                    {!isSetup && !metadata && !error && (
                        <div
                            role="status"
                            className="space-y-2 rounded-lg border border-border bg-surface-subtle p-4"
                        >
                            <span className="sr-only">Loading vault key…</span>
                            <div
                                aria-hidden="true"
                                className="h-3 w-32 rounded bg-surface-muted"
                            />
                            <div
                                aria-hidden="true"
                                className="h-3 w-3/4 rounded bg-surface-muted"
                            />
                        </div>
                    )}

                    {isSetup && method === 'PRF' && (
                        <div className="rounded-lg border border-border bg-surface-subtle p-4">
                            <p className="text-sm font-semibold text-fg-secondary">
                                Unlock with your device
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                Use your Mossy passkey for this vault. We’ll
                                create one if you haven’t set one up in this
                                browser.
                            </p>
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                    setMethod('Text');
                                    setError(null);
                                }}
                                className="mt-3 rounded-sm text-sm font-semibold text-fg-brand underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Use a password instead
                            </button>
                        </div>
                    )}

                    {isPasskeyUnlock && !error && (
                        <div
                            role="status"
                            className="rounded-lg border border-border bg-surface-subtle p-4"
                        >
                            <p className="text-sm font-semibold text-fg-secondary">
                                Waiting for your passkey
                            </p>
                            <p className="mt-1 text-sm leading-6 text-fg-muted">
                                Complete the prompt from your browser or device.
                            </p>
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
                                    autoFocus
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
                                    disabled={isBusy}
                                    className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm text-fg-primary focus:border-fg-brand focus:outline-none focus:ring-2 focus:ring-fg-brand/20 disabled:cursor-wait disabled:opacity-60"
                                />
                                {isSetup && (
                                    <p
                                        id={passwordHintId}
                                        className="text-xs leading-5 text-fg-muted"
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
                                        name="confirmation"
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
                                        disabled={isBusy}
                                        className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm text-fg-primary focus:border-fg-brand focus:outline-none focus:ring-2 focus:ring-fg-brand/20 disabled:cursor-wait disabled:opacity-60"
                                    />
                                </div>
                            )}
                        </div>
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
                        disabled={!canDismiss}
                        onClick={dismiss}
                        className="min-h-10 whitespace-nowrap text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </Button>
                    {(isSetup || showPassword || error) && (
                        <Button
                            type="submit"
                            padding="medium"
                            disabled={isBusy}
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
