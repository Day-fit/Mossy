import {
    useMemo,
    type ChangeEvent,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { MdErrorOutline, MdUploadFile } from 'react-icons/md';
import type { PasswordFormState } from './index.ts';
import { validateSshKeyPair } from './secretPayload.ts';

type SshPasswordFormState = Extract<
    PasswordFormState,
    { passwordType: 'SSH_KEY' }
>;

type SshKeyEntryInputProps = {
    formState: SshPasswordFormState;
    setFormState: Dispatch<SetStateAction<PasswordFormState>>;
    setSubmitError: (value: string | null) => void;
};

async function readFileText(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return null;

    return {
        name: file.name,
        content: await file.text(),
    };
}

export default function SshKeyEntryInput({
    formState,
    setFormState,
    setSubmitError,
}: SshKeyEntryInputProps) {
    const validationMessage = useMemo(
        () => validateSshKeyPair(formState.privateKey, formState.publicKey),
        [formState.privateKey, formState.publicKey]
    );

    const updateField = (field: 'privateKey' | 'publicKey', value: string) => {
        setSubmitError(null);
        setFormState((prev) =>
            prev.passwordType === 'SSH_KEY'
                ? {
                      ...prev,
                      [field]: value,
                  }
                : prev
        );
    };

    const handleFile = async (
        field: 'privateKey' | 'publicKey',
        event: ChangeEvent<HTMLInputElement>
    ) => {
        setSubmitError(null);

        try {
            const file = await readFileText(event);
            if (!file) return;

            updateField(field, file.content);
        } catch {
            setSubmitError('Could not read selected SSH key file.');
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="flex min-h-56 flex-col gap-2 rounded-sm border border-border p-3">
                <span className="type-label text-fg-secondary">
                    Private key <span className="text-danger">*</span>
                </span>
                <textarea
                    name="privateKey"
                    value={formState.privateKey}
                    onChange={(event) =>
                        updateField('privateKey', event.target.value)
                    }
                    className="min-h-40 flex-1 resize-y border-0 bg-surface-subtle p-2 type-code outline-none focus:ring-2 focus:ring-focus"
                    required
                    spellCheck={false}
                />
                <span className="inline-flex items-center gap-2 type-body-sm text-fg-muted">
                    <MdUploadFile size={16} />
                    <input
                        type="file"
                        accept=".pem,.ppk,.key,text/plain"
                        onChange={(event) =>
                            void handleFile('privateKey', event)
                        }
                        className="type-body-sm"
                    />
                </span>
            </label>

            <label className="flex min-h-56 flex-col gap-2 rounded-sm border border-border p-3">
                <span className="type-label text-fg-secondary">Public key</span>
                <textarea
                    name="publicKey"
                    value={formState.publicKey}
                    onChange={(event) =>
                        updateField('publicKey', event.target.value)
                    }
                    className="min-h-40 flex-1 resize-y border-0 bg-surface-subtle p-2 type-code outline-none focus:ring-2 focus:ring-focus"
                    spellCheck={false}
                />
                <span className="inline-flex items-center gap-2 type-body-sm text-fg-muted">
                    <MdUploadFile size={16} />
                    <input
                        type="file"
                        accept=".pub,text/plain"
                        onChange={(event) =>
                            void handleFile('publicKey', event)
                        }
                        className="type-body-sm"
                    />
                </span>
            </label>

            {validationMessage ? (
                <p className="inline-flex items-center gap-1 type-body-sm text-danger lg:col-span-2">
                    <MdErrorOutline size={16} />
                    {validationMessage}
                </p>
            ) : null}
        </div>
    );
}
