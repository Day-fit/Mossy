import {motion, stagger, type Variants} from "framer-motion";
import {useEffect, useState, type FormEvent} from "react";
import RippleButton from "../layout/RippleButton.tsx";
import {
    executeCreateVaultRequest,
    executeDeleteVaultRequest,
    executeUpdateVaultRequest,
    executeUserVaultsRequest,
    type UserVaultDto
} from "../../api/vault.api.ts";
import VaultCard from "./VaultCard.tsx";
import AddVaultModal from "./AddVaultModal.tsx";

type CreatedVaultState = {
    vaultId: string;
    apiKey: string;
} | null;

export default function VaultHero() {
    const [vaults, setVaults] = useState<UserVaultDto[]>([]);
    const [vaultName, setVaultName] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [createdVault, setCreatedVault] = useState<CreatedVaultState>(null);

    const containerVariants: Variants = {
        hidden: {opacity: 0, y: 20},
        show: {
            opacity: 1,
            y: 0,
            transition: {duration: 0.4, ease: "easeOut", delayChildren: stagger(0.08)},
        },
    };

    const loadVaults = async () => {
        try {
            const nextVaults = await executeUserVaultsRequest();
            setVaults(nextVaults);
            setErrorMessage(null);
        } catch {
            setVaults([]);
            setErrorMessage("Failed to load vaults");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadVaults();
    }, []);

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const response = await executeCreateVaultRequest(vaultName);
            setCreatedVault({vaultId: response.vaultId, apiKey: response.apiKey});
            setSuccessMessage("Vault created successfully");
            setVaultName("");
            await loadVaults();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to create vault");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRename = async (vaultId: string, currentName: string) => {
        const nextName = window.prompt("Enter new vault name", currentName);
        if (!nextName || nextName.trim().length === 0 || nextName === currentName) {
            return;
        }

        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);
        try {
            const response = await executeUpdateVaultRequest(vaultId, nextName);
            setSuccessMessage(response.message);
            await loadVaults();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to rename vault");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (vaultId: string) => {
        if (!window.confirm("Delete this vault?")) {
            return;
        }

        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);
        try {
            const response = await executeDeleteVaultRequest(vaultId);
            setSuccessMessage(response.message);
            await loadVaults();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete vault");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="w-full px-4 py-5">
            <motion.section className="mx-auto max-w-7xl space-y-6" variants={containerVariants} initial="hidden" animate="show">
                <motion.div className="rounded-xl bg-white p-6 shadow-md">
                    <h2 className="mb-2 text-3xl font-semibold text-gray-900">Vaults</h2>
                    <p className="mb-6 text-sm text-gray-600">Manage your existing vaults and create new vault credentials.</p>

                    <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                            type="text"
                            value={vaultName}
                            onChange={(event) => setVaultName(event.target.value)}
                            placeholder="Vault name"
                            className="rounded-md border border-gray-200 px-3 py-2"
                            minLength={1}
                            maxLength={80}
                            required
                        />
                        <RippleButton type="submit" className="px-5 py-2 text-white" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Add vault"}
                        </RippleButton>
                    </form>

                    {successMessage ? <p className="mt-3 text-sm text-emerald-700">{successMessage}</p> : null}
                    {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
                </motion.div>

                <motion.div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {isLoading ? <p className="text-sm text-gray-500">Loading vaults...</p> : null}
                    {!isLoading && vaults.length === 0 ? <p className="text-sm text-gray-500">No vaults available.</p> : null}
                    {vaults.map((vault) => (
                        <VaultCard
                            key={vault.vaultId}
                            vaultId={vault.vaultId}
                            vaultName={vault.vaultName}
                            isOnline={vault.isOnline}
                            lastSeenAt={vault.lastSeenAt}
                            onRename={() => void handleRename(vault.vaultId, vault.vaultName)}
                            onDelete={() => void handleDelete(vault.vaultId)}
                        />
                    ))}
                </motion.div>
            </motion.section>

            {createdVault ? (
                <AddVaultModal
                    vaultId={createdVault.vaultId}
                    apiKey={createdVault.apiKey}
                    onClose={() => setCreatedVault(null)}
                />
            ) : null}
        </section>
    );
}
