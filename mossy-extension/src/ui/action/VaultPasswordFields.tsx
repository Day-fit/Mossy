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
            <label htmlFor="vault-password">
                {isReceiving
                    ? 'Protect with a vault password'
                    : 'Vault password'}
            </label>
            <div className="password-field">
                <input
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
                    className="password-toggle"
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
            <p id="vault-password-hint" className="muted field-hint">
                {isReceiving
                    ? 'Use at least 12 characters to protect this vault on this browser.'
                    : 'Use your vault password to authorize this action.'}
            </p>
            {isReceiving && (
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
                        placeholder="Enter the same password again"
                        aria-invalid={!!error}
                        aria-describedby={error ? 'action-feedback' : undefined}
                    />
                </>
            )}
        </>
    );
}
