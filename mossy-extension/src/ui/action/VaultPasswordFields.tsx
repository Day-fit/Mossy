import { useState, type RefObject } from 'react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { VAULT_PASSWORD_MIN_LENGTH } from '../../security/vaultCrypto';

type VaultPasswordFieldsProps = {
    isReceiving: boolean;
    password: RefObject<HTMLInputElement | null>;
    confirmation: RefObject<HTMLInputElement | null>;
    error: string;
};

export default function VaultPasswordFields({
    isReceiving,
    password,
    confirmation,
    error,
}: VaultPasswordFieldsProps) {
    const [visible, setVisible] = useState(false);
    return (
        <>
            <label
                className="mt-4 mb-[7px] block text-xs leading-normal font-semibold text-fg-secondary"
                htmlFor="vault-password"
            >
                {isReceiving
                    ? 'Protect with a vault password'
                    : 'Vault password'}
            </label>
            <div className="relative">
                <input
                    className="block min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface pl-3 pr-12 py-2.5 text-sm leading-normal text-fg-primary placeholder:text-fg-subtle placeholder:opacity-100 focus-visible:border-fg-brand focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-fg-danger"
                    ref={password}
                    id="vault-password"
                    type={visible ? 'text' : 'password'}
                    required
                    autoComplete="off"
                    autoFocus
                    aria-describedby={
                        error
                            ? 'vault-password-hint action-feedback'
                            : 'vault-password-hint'
                    }
                    aria-invalid={!!error}
                    placeholder={
                        isReceiving
                            ? 'Choose a vault password'
                            : 'Enter your vault password'
                    }
                    minLength={
                        isReceiving ? VAULT_PASSWORD_MIN_LENGTH : undefined
                    }
                />
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer absolute inset-y-1 right-1 w-10 rounded-md border-0 bg-transparent p-0 text-fg-muted hover:bg-surface-subtle hover:text-fg-brand focus-visible:-outline-offset-2"
                    aria-label={
                        visible ? 'Hide vault password' : 'Show vault password'
                    }
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                >
                    {visible ? (
                        <MdVisibilityOff size={19} aria-hidden="true" />
                    ) : (
                        <MdVisibility size={19} aria-hidden="true" />
                    )}
                </button>
            </div>
            <p
                id="vault-password-hint"
                className="leading-[1.6] text-xs text-fg-muted mt-2"
            >
                {isReceiving
                    ? 'Use at least 12 characters to protect this vault on this browser.'
                    : 'Use your vault password to authorize this action.'}
            </p>
            {isReceiving && (
                <>
                    <label
                        className="mt-4 mb-[7px] block text-xs leading-normal font-semibold text-fg-secondary"
                        htmlFor="vault-password-confirmation"
                    >
                        Confirm vault password
                    </label>
                    <input
                        className="block min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm leading-normal text-fg-primary placeholder:text-fg-subtle placeholder:opacity-100 focus-visible:border-fg-brand focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-fg-danger"
                        ref={confirmation}
                        id="vault-password-confirmation"
                        type="password"
                        required
                        autoComplete="off"
                        placeholder="Enter the same password again"
                        aria-invalid={!!error}
                        aria-describedby={error ? 'action-feedback' : undefined}
                    />
                </>
            )}
        </>
    );
}
