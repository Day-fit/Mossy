import { useEffect, useId, useState, type FormEvent } from 'react';
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
    const {
        getKeyMetadata,
        prepareProtection,
        registerVaultKey,
        unlockVault,
    } = useEncryptionHook();
    const [metadata, setMetadata] = useState<VaultKeyMetadata | null>(null);
    const [method, setMethod] = useState<VaultMethod>(
        typeof PublicKeyCredential !== 'undefined' ? 'PRF' : 'Password'
    );
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const titleId = useId();
    const isSetup = mode !== 'unlock';
    const showPassword = isSetup
        ? method === 'Password'
        : metadata?.type === 'Password';

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

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
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
                    ? { type: 'PRF' }
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
            if (isSetup && reason instanceof PrfNotSupportedError) {
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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onSubmit={(event) => void submit(event)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') onClose();
                }}
                className="w-full max-w-lg space-y-5 rounded-xl bg-surface p-6 text-fg-primary shadow-modal"
            >
                <div>
                    <h2 id={titleId} className="text-2xl">
                        {isSetup ? 'Protect your vault' : 'Unlock your vault'}
                    </h2>
                    <p className="mt-2 text-sm text-fg-muted">
                        {isSetup
                            ? 'Choose how to protect the vault key on this browser.'
                            : metadata?.type === 'PRF'
                              ? 'Confirm with your passkey to continue.'
                              : 'Enter your vault password to continue.'}
                    </p>
                </div>

                {isSetup && (
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant={method === 'PRF' ? 'primary' : 'outline'}
                            disabled={busy}
                            onClick={() => setMethod('PRF')}
                        >
                            Passkey
                        </Button>
                        <Button
                            type="button"
                            variant={method === 'Password' ? 'primary' : 'outline'}
                            disabled={busy}
                            onClick={() => setMethod('Password')}
                        >
                            Password
                        </Button>
                    </div>
                )}

                {showPassword && (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium">
                            Vault password
                            <input
                                type="password"
                                autoFocus
                                autoComplete={isSetup ? 'new-password' : 'current-password'}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={busy}
                                required
                                minLength={isSetup ? VAULT_PASSWORD_MIN_LENGTH : undefined}
                                className="mt-2 w-full rounded-md border border-border-strong bg-surface px-3 py-2"
                            />
                        </label>
                        {isSetup && (
                            <label className="block text-sm font-medium">
                                Confirm password
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmation}
                                    onChange={(event) => setConfirmation(event.target.value)}
                                    disabled={busy}
                                    required
                                    className="mt-2 w-full rounded-md border border-border-strong bg-surface px-3 py-2"
                                />
                            </label>
                        )}
                    </div>
                )}

                {notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
                {error && <p role="alert" className="text-sm text-fg-danger">{error}</p>}

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={busy || (mode === 'unlock' && !metadata)}>
                        {busy ? 'Working…' : isSetup ? 'Continue' : 'Unlock vault'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
