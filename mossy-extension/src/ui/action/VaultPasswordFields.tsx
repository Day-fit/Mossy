import type { RefObject } from 'react';
import { VAULT_PASSWORD_MIN_LENGTH } from '../../security/vaultCrypto';

type VaultPasswordFieldsProps = {
    isReceiving: boolean;
    password: RefObject<HTMLInputElement | null>;
    confirmation: RefObject<HTMLInputElement | null>;
};

export default function VaultPasswordFields({
    isReceiving,
    password,
    confirmation,
}: VaultPasswordFieldsProps) {
    return (
        <>
            <label htmlFor="vault-password">
                {isReceiving
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
                minLength={isReceiving ? VAULT_PASSWORD_MIN_LENGTH : undefined}
            />
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
                    />
                </>
            )}
        </>
    );
}
