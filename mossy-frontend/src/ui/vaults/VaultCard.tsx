import {motion} from "framer-motion";
import VaultOptionsMenu from "./VaultOptionsMenu.tsx";
import RippleButton from "../layout/RippleButton.tsx";

type VaultCardProps = {
    vaultId: string;
    vaultName: string;
    isOnline: boolean;
    lastSeenAt: string | null;
    onRename: () => void;
    onDelete: () => void;
};

function copyText(value: string) {
    void navigator.clipboard.writeText(value);
}

export default function VaultCard({
    vaultId,
    vaultName,
    isOnline,
    lastSeenAt,
    onRename,
    onDelete
}: VaultCardProps) {
    const statusClassName = isOnline ? "text-green-600" : "text-red-600";
    const formattedLastSeenAt = lastSeenAt ? new Date(lastSeenAt).toLocaleString() : "Never";

    return (
        <motion.article
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-md"
            initial={{opacity: 0, y: 18}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3}}
        >
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900">{vaultName}</h3>
                    <p className={`text-sm ${statusClassName}`}>{isOnline ? "Online" : "Offline"}</p>
                    <p className="text-xs text-gray-500">Last seen: {formattedLastSeenAt}</p>
                </div>

                <VaultOptionsMenu onRename={onRename} onDelete={onDelete} onCopyVaultId={() => copyText(vaultId)} />
            </div>

            <label className="mb-2 block text-xs font-medium text-gray-600">Vault ID</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={vaultId}
                    readOnly
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700"
                />
                <RippleButton
                    type="button"
                    variant="outline"
                    className="px-4 py-2 text-sm"
                    rippleColor="rgb(0, 0, 0, 0.7)"
                    onClick={() => copyText(vaultId)}
                >
                    Copy
                </RippleButton>
            </div>
        </motion.article>
    );
}
