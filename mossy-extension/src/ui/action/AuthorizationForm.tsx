import type { RefObject } from 'react';
import { Button } from '@mossy/ui';
import { MdFingerprint } from 'react-icons/md';
import ProtectionChoices from './ProtectionChoices';
import VaultPasswordFields from './VaultPasswordFields';
import type { ProtectionChoice } from './authorization';

type AuthorizationFormProps = {
    isReceiving: boolean;
    choice: ProtectionChoice | null;
    method: 'PRF' | 'Password' | undefined;
    password: RefObject<HTMLInputElement | null>;
    confirmation: RefObject<HTMLInputElement | null>;
    authorize: () => Promise<void>;
    selectChoice: (choice: ProtectionChoice | null) => void;
};

export default function AuthorizationForm({
    isReceiving,
    choice,
    method,
    password,
    confirmation,
    authorize,
    selectChoice,
}: AuthorizationFormProps) {
    return (
        <form
            id="authorize-form"
            onSubmit={(event) => {
                event.preventDefault();
                void authorize();
            }}
        >
            {isReceiving && !choice && (
                <ProtectionChoices selectChoice={selectChoice} />
            )}
            {isReceiving && choice === 'register-passkey' && (
                <div className="status">
                    <div>
                        <strong>This may replace an existing passkey</strong>
                        <p>
                            Replacing this vault’s passkey can prevent other
                            browsers or devices from unlocking copies of this
                            vault that use the old passkey.
                        </p>
                    </div>
                </div>
            )}
            {method === 'Password' ? (
                <VaultPasswordFields
                    isReceiving={isReceiving}
                    password={password}
                    confirmation={confirmation}
                />
            ) : method === 'PRF' ? (
                <div className="passkey-prompt">
                    <MdFingerprint size={22} aria-hidden="true" />
                    <p>
                        {choice === 'register-passkey'
                            ? 'This passkey will protect only this vault.'
                            : 'Select the existing passkey for this vault.'}
                    </p>
                </div>
            ) : null}
            {isReceiving && choice && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => selectChoice(null)}
                >
                    Choose another method
                </Button>
            )}
        </form>
    );
}
