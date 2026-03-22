import {motion} from "framer-motion";
import RippleButton from "../layout/RippleButton.tsx";

type AddVaultModalProps = {
    vaultId: string;
    apiKey: string;
    onClose: () => void;
};

function copyText(value: string) {
    void navigator.clipboard.writeText(value);
}

export default function AddVaultModal({vaultId, apiKey, onClose}: AddVaultModalProps) {
    return (
        <motion.section
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
        >
            <motion.div
                className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
                initial={{scale: 0.95, y: 12}}
                animate={{scale: 1, y: 0}}
            >
                <h3 className="mb-2 text-2xl font-semibold text-gray-900">Vault created</h3>
                <p className="mb-5 text-sm text-gray-600">Copy these credentials now. API key is shown only once.</p>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-xs font-medium text-gray-600">Vault ID</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={vaultId}
                                readOnly
                                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
                            />
                            <RippleButton type="button" variant="outline" className="px-4 py-2 text-sm" rippleColor="rgb(0, 0, 0, 0.7)" onClick={() => copyText(vaultId)}>
                                Copy
                            </RippleButton>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-medium text-gray-600">API key</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={apiKey}
                                readOnly
                                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
                            />
                            <RippleButton type="button" variant="outline" className="px-4 py-2 text-sm" rippleColor="rgb(0, 0, 0, 0.7)" onClick={() => copyText(apiKey)}>
                                Copy
                            </RippleButton>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <RippleButton type="button" className="px-6 py-2 text-white" onClick={onClose}>
                        Done
                    </RippleButton>
                </div>
            </motion.div>
        </motion.section>
    );
}
