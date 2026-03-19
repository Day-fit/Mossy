import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
    executeSavePasswordRequest,
    type ServerResponseDto,
} from "../../api/password.api.ts";
import { executeUserVaultsRequest, type UserVaultDto } from "../../api/vault.api.ts";
import StrengthMetter from "./StrengthMetter.tsx";

export default function PasswordHero() {
    const [identifier, setIdentifier] = useState("");
    const [domain, setDomain] = useState("");
    const [password, setPassword] = useState("");

    const [vaults, setVaults] = useState<UserVaultDto[]>([]);
    const [selectedVaultId, setSelectedVaultId] = useState("");
    const [isLoadingVaults, setIsLoadingVaults] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const onlineVaults = useMemo(() => vaults.filter((vault) => vault.isOnline), [vaults]);

    useEffect(() => {
        const loadVaults = async () => {
            try {
                const nextVaults = await executeUserVaultsRequest();
                setVaults(nextVaults);

                const firstOnlineVault = nextVaults.find((vault) => vault.isOnline);
                setSelectedVaultId(firstOnlineVault?.vaultId ?? "");
                setErrorMessage(null);
            } catch {
                setVaults([]);
                setSelectedVaultId("");
                setErrorMessage("Failed to load your vaults");
            } finally {
                setIsLoadingVaults(false);
            }
        };

        void loadVaults();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedVaultId) {
            setErrorMessage("Select an online vault to save password");
            return;
        }

        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const response: ServerResponseDto = await executeSavePasswordRequest({
                identifier,
                domain,
                cipherText: password,
                vaultId: selectedVaultId,
            });

            setSuccessMessage(response.message);
            setIdentifier("");
            setDomain("");
            setPassword("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to save password");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="w-full p-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-md bg-white p-5 shadow-md">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <input
                        type="text"
                        name="identifier"
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        placeholder="Enter identifier (email/username)"
                        className="border-b-2 p-2"
                        required
                    />

                    <input
                        type="text"
                        name="domain"
                        value={domain}
                        onChange={(event) => setDomain(event.target.value)}
                        placeholder="Enter domain"
                        className="border-b-2 p-2"
                        required
                    />

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-gray-600" htmlFor="vault-select">
                            Vault
                        </label>
                        <select
                            id="vault-select"
                            name="vaultId"
                            value={selectedVaultId}
                            onChange={(event) => setSelectedVaultId(event.target.value)}
                            className="border-b-2 p-2"
                            disabled={isLoadingVaults || onlineVaults.length === 0 || isSubmitting}
                            required
                        >
                            {isLoadingVaults ? <option>Loading vaults...</option> : null}
                            {!isLoadingVaults && onlineVaults.length === 0 ? (
                                <option value="">No online vaults available</option>
                            ) : null}
                            {!isLoadingVaults
                                ? onlineVaults.map((vault) => (
                                      <option key={vault.vaultId} value={vault.vaultId}>
                                          {vault.vaultName}
                                      </option>
                                  ))
                                : null}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <input
                            type="password"
                            name="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter password"
                            className="border-b-2 p-2"
                            required
                        />
                        <StrengthMetter password={password} />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        className="rounded-sm border-2 px-4 py-2"
                        disabled={isSubmitting || isLoadingVaults || onlineVaults.length === 0}
                    >
                        {isSubmitting ? "Saving..." : "Add"}
                    </button>

                    {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
                    {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                </div>
            </form>
        </section>
    );
}
