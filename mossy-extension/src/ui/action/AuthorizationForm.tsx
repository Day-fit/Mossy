import type { RefObject } from 'react';
import { Button } from '@mossy/ui';
import { MdFingerprint } from 'react-icons/md';
import ProtectionChoices from './ProtectionChoices';
import VaultPasswordFields from './VaultPasswordFields';
import type { ProtectionChoice } from './authorization';
import ViewTransition from '../shared/ViewTransition';

type AuthorizationFormProps = {
    isReceiving: boolean;
    choice: ProtectionChoice | null;
    method: 'PRF' | 'Password' | undefined;
    password: RefObject<HTMLInputElement | null>;
    confirmation: RefObject<HTMLInputElement | null>;
    authorize: () => Promise<void>;
    selectChoice: (choice: ProtectionChoice | null) => void;
    error: string;
};

export default function AuthorizationForm({
    isReceiving,
    choice,
    method,
    password,
    confirmation,
    authorize,
    selectChoice,
    error,
}: AuthorizationFormProps) {
    return (
        <form
            id="authorize-form"
            onSubmit={(event) => {
                event.preventDefault();
                void authorize();
            }}
        >
            <ViewTransition viewKey={choice ?? method ?? 'choices'}>
                {isReceiving && !choice && (
                    <ProtectionChoices selectChoice={selectChoice} />
                )}
                {isReceiving && choice === 'register-passkey' && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-subtle p-3 text-[0.8125rem] leading-[1.65] text-fg-secondary [overflow-wrap:anywhere] [&>svg]:mt-0.5 [&>svg]:shrink-0 mt-[18px]">
                        <div>
                            <strong>
                                This may replace an existing passkey
                            </strong>
                            <p className="text-[0.8125rem] leading-[1.6] text-fg-secondary">
                                Replacing this vault’s passkey can prevent other
                                browsers or devices from unlocking copies of
                                this vault that use the old passkey.
                            </p>
                        </div>
                    </div>
                )}
                {method === 'Password' ? (
                    <VaultPasswordFields
                        isReceiving={isReceiving}
                        password={password}
                        confirmation={confirmation}
                        error={error}
                    />
                ) : method === 'PRF' ? (
                    <div className="flex items-start gap-3 rounded-[9px] border border-border bg-surface-subtle p-4 text-fg-brand">
                        <MdFingerprint
                            className="mt-[3px] shrink-0"
                            size={22}
                            aria-hidden="true"
                        />
                        <p className="text-[0.8125rem] leading-[1.6] text-fg-secondary">
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
                        className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer mt-4"
                        onClick={() => selectChoice(null)}
                    >
                        Choose another method
                    </Button>
                )}
            </ViewTransition>
        </form>
    );
}
