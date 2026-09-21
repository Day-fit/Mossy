import { motion } from 'framer-motion';
import Button from '../shared/Button.tsx';

type AddVaultModalProps = {
    vaultId: string;
    apiKey: string;
    onClose: () => void;
};

function copyText(value: string) {
    void navigator.clipboard.writeText(value);
}

export default function AddVaultModal({
    vaultId,
    apiKey,
    onClose,
}: AddVaultModalProps) {
    return (
        <motion.section
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <motion.div
                className="w-full max-w-2xl rounded-xl bg-surface-card p-6 shadow-modal"
                initial={{ scale: 0.95, y: 12 }}
                animate={{ scale: 1, y: 0 }}
            >
                <h3 className="mb-2 type-dialog-title text-fg-primary">
                    Vault created
                </h3>
                <p className="mb-5 type-body-sm text-fg-muted">
                    Copy these credentials now. API key is shown only once.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block type-caption-strong text-fg-muted">
                            Vault ID
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={vaultId}
                                readOnly
                                className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 type-code-sm text-fg-secondary"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="px-4 py-2 type-button-sm"
                                onClick={() => copyText(vaultId)}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block type-caption-strong text-fg-muted">
                            API key
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={apiKey}
                                readOnly
                                className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 type-code-sm text-fg-secondary"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="px-4 py-2 type-button-sm"
                                onClick={() => copyText(apiKey)}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        className="px-6 py-2 text-fg-inverse"
                        onClick={onClose}
                    >
                        Done
                    </Button>
                </div>
            </motion.div>
        </motion.section>
    );
}
