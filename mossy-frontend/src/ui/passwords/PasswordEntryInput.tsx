import { useId, useState } from 'react';
import { MdCheck, MdClose, MdPassword, MdVpnKey } from 'react-icons/md';
import type {
    PasswordFormState,
    SavePasswordResult,
    WebsiteProtocol,
} from './index.ts';
import StrengthMeter from './StrengthMeter.tsx';
import Button from '../shared/Button.tsx';
import type { PasswordType } from '../../api/password.api.ts';
import SshKeyEntryInput from './SshKeyEntryInput.tsx';
import { validateSshKeyPair } from './secretPayload.ts';
import { motion } from 'framer-motion';
import {
    normalizePasswordAddress,
    splitWebsiteAddress,
} from './passwordAddress.ts';

type PasswordEntryInputProps = {
    initialState?: PasswordFormState;
    isEditing?: boolean;
    isSubmitting: boolean;
    isVaultOnline: boolean;
    onSubmit: (state: PasswordFormState) => Promise<SavePasswordResult>;
    onCancel: () => void;
};

const EMPTY_FORM_STATE: PasswordFormState = {
    identifier: '',
    address: '',
    password: '',
    passwordType: 'PASSWORD',
    protocol: 'https://',
};

const inputClassName =
    'min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg-primary placeholder:text-fg-subtle focus:border-fg-brand focus:outline-none focus:ring-1 focus:ring-fg-brand disabled:cursor-wait disabled:opacity-60';

export default function PasswordEntryInput({
    initialState = EMPTY_FORM_STATE,
    isEditing = false,
    isSubmitting,
    isVaultOnline,
    onSubmit,
    onCancel,
}: PasswordEntryInputProps) {
    const formId = useId();
    const [formState, setFormState] = useState<PasswordFormState>(() => ({
        ...initialState,
    }));
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitPending, setIsSubmitPending] = useState(false);
    const isBusy = isSubmitting || isSubmitPending;

    const handleAddressChange = (address: string) => {
        setFormState((prev) =>
            prev.passwordType === 'PASSWORD'
                ? { ...prev, ...splitWebsiteAddress(address, prev.protocol) }
                : { ...prev, address }
        );
    };

    const handleProtocolChange = (protocol: WebsiteProtocol) => {
        setFormState((prev) =>
            prev.passwordType === 'PASSWORD' ? { ...prev, protocol } : prev
        );
    };

    const handlePasswordTypeChange = (passwordType: PasswordType) => {
        if (passwordType === formState.passwordType) return;

        setSubmitError(null);
        setFormState((prev) =>
            passwordType === 'SSH_KEY'
                ? {
                      identifier: prev.identifier,
                      address: prev.address,
                      privateKey: '',
                      publicKey: '',
                      passwordType,
                  }
                : {
                      identifier: prev.identifier,
                      address: prev.address,
                      password: '',
                      protocol: 'https://',
                      passwordType,
                  }
        );
    };

    const handlePasswordChange = (password: string) => {
        setFormState((prev) =>
            prev.passwordType === 'PASSWORD'
                ? {
                      ...prev,
                      password,
                  }
                : prev
        );
    };

    return (
        <motion.form
            onSubmit={(event) => {
                event.preventDefault();

                void (async () => {
                    if (isBusy) return;

                    setSubmitError(null);
                    let shouldClose = false;

                    try {
                        const address = normalizePasswordAddress(formState);

                        if (formState.passwordType === 'SSH_KEY') {
                            const validationMessage = validateSshKeyPair(
                                formState.privateKey,
                                formState.publicKey
                            );

                            if (validationMessage) {
                                setSubmitError(validationMessage);
                                return;
                            }
                        }

                        setIsSubmitPending(true);

                        const result = await onSubmit({
                            ...formState,
                            address,
                        });

                        shouldClose = result === 'saved';
                    } catch (error) {
                        setSubmitError(
                            error instanceof Error
                                ? error.message
                                : 'Could not save this entry. Try again.'
                        );
                    } finally {
                        if (!shouldClose) {
                            setIsSubmitPending(false);
                        }
                    }

                    if (shouldClose) {
                        onCancel();
                    }
                })();
            }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                }
            }}
            animate={{ opacity: isSubmitPending ? [1, 0.6, 1] : 1 }}
            transition={{
                duration: 1.2,
                repeat: isSubmitPending ? Infinity : 0,
                ease: 'easeInOut',
            }}
            className="flex min-w-0 flex-col gap-5 rounded-md border border-border bg-surface p-4"
            aria-label={isEditing ? 'Edit vault entry' : 'New vault entry'}
            aria-busy={isBusy}
        >
            <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-sm text-fg-secondary">
                        {formState.passwordType === 'SSH_KEY' ? (
                            <MdVpnKey size={16} />
                        ) : (
                            <MdPassword size={16} />
                        )}
                        {formState.passwordType === 'SSH_KEY'
                            ? 'SSH key'
                            : 'Password'}
                    </span>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => handlePasswordTypeChange('PASSWORD')}
                            disabled={isBusy}
                            className={`inline-flex min-h-11 items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-wait ${
                                formState.passwordType === 'PASSWORD'
                                    ? 'border-fg-brand bg-brand/5 text-fg-brand'
                                    : 'border-border text-fg-secondary hover:bg-surface-subtle'
                            }`}
                            aria-pressed={formState.passwordType === 'PASSWORD'}
                        >
                            <MdPassword size={16} />
                            Password
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePasswordTypeChange('SSH_KEY')}
                            disabled={isBusy}
                            className={`inline-flex min-h-11 items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-wait ${
                                formState.passwordType === 'SSH_KEY'
                                    ? 'border-fg-brand bg-brand/5 text-fg-brand'
                                    : 'border-border text-fg-secondary hover:bg-surface-subtle'
                            }`}
                            aria-pressed={formState.passwordType === 'SSH_KEY'}
                        >
                            <MdVpnKey size={16} />
                            SSH key
                        </button>
                    </>
                )}
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                    <label
                        htmlFor={`${formId}-identifier`}
                        className="text-sm font-medium text-fg-secondary"
                    >
                        {formState.passwordType === 'SSH_KEY'
                            ? 'Identifier'
                            : 'Username or email'}
                    </label>

                    <input
                        id={`${formId}-identifier`}
                        type="text"
                        name="identifier"
                        value={formState.identifier}
                        onChange={(event) =>
                            setFormState((prev) => ({
                                ...prev,
                                identifier: event.target.value,
                            }))
                        }
                        placeholder={
                            formState.passwordType === 'SSH_KEY'
                                ? 'deploy'
                                : 'Email or username'
                        }
                        className={inputClassName}
                        disabled={isBusy}
                        required
                        autoFocus
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <label
                        htmlFor={`${formId}-address`}
                        className="text-sm font-medium text-fg-secondary"
                    >
                        {formState.passwordType === 'SSH_KEY'
                            ? 'Host'
                            : 'Website'}
                    </label>

                    <div className="flex min-h-11 min-w-0 overflow-hidden rounded-md border border-border-strong bg-surface focus-within:border-fg-brand focus-within:ring-1 focus-within:ring-fg-brand">
                        {formState.passwordType === 'PASSWORD' && (
                            <select
                                name="protocol"
                                aria-label="Website protocol"
                                value={formState.protocol}
                                onChange={(event) =>
                                    handleProtocolChange(
                                        event.target.value === 'http://'
                                            ? 'http://'
                                            : 'https://'
                                    )
                                }
                                className="min-h-11 shrink-0 cursor-pointer border-r border-border bg-surface-subtle px-3 text-sm text-fg-secondary focus:outline-none disabled:cursor-wait"
                                disabled={isBusy}
                            >
                                <option value="https://">https://</option>
                                <option value="http://">http://</option>
                            </select>
                        )}

                        <input
                            id={`${formId}-address`}
                            type="text"
                            name="address"
                            value={formState.address}
                            onChange={(event) =>
                                handleAddressChange(event.target.value)
                            }
                            placeholder={
                                formState.passwordType === 'SSH_KEY'
                                    ? 'server.example:2222'
                                    : 'Domain or IP address'
                            }
                            className="min-h-11 w-full min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-fg-primary placeholder:text-fg-subtle focus:outline-none disabled:cursor-wait"
                            disabled={isBusy}
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                        />
                    </div>

                    <p className="text-xs leading-relaxed text-fg-muted">
                        {formState.passwordType === 'SSH_KEY'
                            ? 'Hostname or IP address, with an optional port.'
                            : 'Paste a full URL, or enter a domain and optional port.'}
                    </p>
                </div>
            </div>

            {formState.passwordType === 'SSH_KEY' ? (
                <SshKeyEntryInput
                    formState={formState}
                    setFormState={setFormState}
                    setSubmitError={setSubmitError}
                />
            ) : (
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor={`${formId}-password`}
                        className="text-sm font-medium text-fg-secondary"
                    >
                        {isEditing ? 'New password' : 'Password'}
                    </label>

                    <input
                        id={`${formId}-password`}
                        type="password"
                        name="password"
                        value={formState.password}
                        onChange={(event) =>
                            handlePasswordChange(event.target.value)
                        }
                        placeholder={
                            isEditing ? 'Enter new password' : 'Enter password'
                        }
                        className={inputClassName}
                        disabled={isBusy}
                        required
                    />
                    <StrengthMeter password={formState.password} />
                </div>
            )}

            {submitError ? (
                <p role="alert" className="text-sm text-fg-danger">
                    {submitError}
                </p>
            ) : null}

            <div className="flex items-center gap-2">
                <Button
                    type="submit"
                    padding="medium"
                    disabled={isBusy || !isVaultOnline}
                    className="inline-flex min-h-11 items-center gap-1"
                >
                    <MdCheck size={16} />
                    {isBusy ? 'Saving...' : isEditing ? 'Update' : 'Add'}
                </Button>

                <Button
                    type="button"
                    padding="medium"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isBusy}
                    className="inline-flex min-h-11 items-center gap-1"
                >
                    <MdClose size={16} />
                    Cancel
                </Button>
            </div>
        </motion.form>
    );
}
