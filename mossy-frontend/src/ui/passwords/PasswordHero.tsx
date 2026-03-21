import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
    executeDeletePasswordRequest,
    executePasswordCiphertextRequest,
    executePasswordMetadataRequest,
    executeSavePasswordRequest,
    executeUpdatePasswordRequest,
    type PasswordMetadataDto,
    type ServerResponseDto,
} from "../../api/password.api.ts";
import { executeUserVaultsRequest, type UserVaultDto } from "../../api/vault.api.ts";
import { useEncryption } from "../../hooks/useEncryption.ts";
import StrengthMetter from "./StrengthMetter.tsx";
import RippleButton from "../layout/RippleButton.tsx";

export default function PasswordHero() {
    const { encrypt, decrypt } = useEncryption();

    const [passwords, setPasswords] = useState<PasswordMetadataDto[]>([]);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

    const [identifier, setIdentifier] = useState("");
    const [domain, setDomain] = useState("");
    const [password, setPassword] = useState("");
    const [editedPasswordId, setEditedPasswordId] = useState<string | null>(null);

    const [vaults, setVaults] = useState<UserVaultDto[]>([]);
    const [selectedVaultId, setSelectedVaultId] = useState("");

    const [isLoadingVaults, setIsLoadingVaults] = useState<boolean>(true);
    const [isLoadingPasswords, setIsLoadingPasswords] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isLoadingCiphertextId, setIsLoadingCiphertextId] = useState<string | null>(null);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const selectedVault = useMemo(
        () => vaults.find((vault) => {
            console.log(vault.vaultId, selectedVaultId, vault)
            return vault.vaultId === selectedVaultId
        }) ?? null,
        [vaults, selectedVaultId]
    );

    const isEditing = editedPasswordId !== null;

    const resetForm = () => {
        setIdentifier("");
        setDomain("");
        setPassword("");
        setEditedPasswordId(null);
    };

    const loadPasswords = async (vaultId: string) => {
        if (!vaultId) {
            setPasswords([]);
            setRevealedPasswords({});
            return;
        }

        setIsLoadingPasswords(true);

        try {
            const nextPasswords = await executePasswordMetadataRequest(vaultId);
            setPasswords(
                nextPasswords.sort((a, b) => {
                    const timeA = new Date(a.lastModified).getTime();
                    const timeB = new Date(b.lastModified).getTime();
                    return timeB - timeA;
                })
            );
            setRevealedPasswords({});
        } catch {
            setPasswords([]);
            setErrorMessage("Failed to load passwords");
        } finally {
            setIsLoadingPasswords(false);
        }
    };

    useEffect(() => {
        const loadVaults = async () => {
            try {
                const nextVaults = await executeUserVaultsRequest();
                setVaults(nextVaults);
                console.log(nextVaults)

                const firstOnlineVault = nextVaults.find((vault) => vault.isOnline);
                setSelectedVaultId(firstOnlineVault?.vaultId ?? nextVaults[0]?.vaultId ?? "");
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

    useEffect(() => {
        if (!selectedVaultId) {
            setPasswords([]);
            setRevealedPasswords({});
            return;
        }

        if (!selectedVault?.isOnline) {
            setPasswords([]);
            setRevealedPasswords({});
            return;
        }

        void loadPasswords(selectedVaultId);
    }, [selectedVault, selectedVaultId]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedVaultId || !selectedVault?.isOnline) {
            setErrorMessage("Select an online vault to save password");
            return;
        }

        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const payload = {
                identifier,
                domain,
                cipherText: encrypt(password),
                vaultId: selectedVaultId,
            };

            const response: ServerResponseDto = isEditing
                ? await executeUpdatePasswordRequest({
                      ...payload,
                      passwordId: editedPasswordId,
                  })
                : await executeSavePasswordRequest(payload);

            setSuccessMessage(response.message);
            resetForm();
            await loadPasswords(selectedVaultId);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to save password data");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (passwordId: string) => {
        if (!selectedVaultId || !selectedVault?.isOnline) {
            return;
        }

        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const response = await executeDeletePasswordRequest({
                passwordId,
                vaultId: selectedVaultId,
            });

            setSuccessMessage(response.message);
            if (editedPasswordId === passwordId) {
                resetForm();
            }
            await loadPasswords(selectedVaultId);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to delete password");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevealToggle = async (passwordId: string) => {
        if (!selectedVaultId || !selectedVault?.isOnline) {
            return;
        }

        if (revealedPasswords[passwordId]) {
            setRevealedPasswords((prev) => {
                const next = { ...prev };
                delete next[passwordId];
                return next;
            });
            return;
        }

        setIsLoadingCiphertextId(passwordId);
        setErrorMessage(null);

        try {
            const response = await executePasswordCiphertextRequest(passwordId, selectedVaultId);
            setRevealedPasswords((prev) => ({
                ...prev,
                [passwordId]: decrypt(response.ciphertext),
            }));
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to reveal password");
        } finally {
            setIsLoadingCiphertextId(null);
        }
    };

    const handleEdit = (passwordDto: PasswordMetadataDto) => {
        setIdentifier(passwordDto.identifier);
        setDomain(passwordDto.domain);
        setPassword("");
        setEditedPasswordId(passwordDto.passwordId);
        setSuccessMessage(null);
        setErrorMessage(null);
    };

    const handleVaultSelect = (vaultId: string) => {
        setSelectedVaultId(vaultId);
        resetForm();
        setSuccessMessage(null);
        setErrorMessage(null);
    };

    return (
        <section className="w-full p-5">
            <section className="mb-6 rounded-md bg-white p-5 shadow-md">
                <h2 className="mb-3 text-xl font-semibold text-gray-800">Select vault</h2>
                {isLoadingVaults ? <p className="text-sm text-gray-500">Loading vaults...</p> : null}
                {!isLoadingVaults && vaults.length === 0 ? (
                    <p className="text-sm text-gray-500">No vaults available</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                    {vaults.map((vault) => (
                        <button
                            key={vault.vaultId}
                            type="button"
                            className={`rounded-md border px-3 py-2 text-sm ${
                                selectedVaultId === vault.vaultId
                                    ? "border-gray-900 bg-gray-900 text-white"
                                    : vault.isOnline
                                      ? "border-gray-300 bg-white text-gray-800"
                                      : "border-red-200 bg-red-50 text-red-700"
                            }`}
                            onClick={() => handleVaultSelect(vault.vaultId)}
                        >
                            <span className="mr-2">{vault.vaultName}</span>
                            <span className="text-xs opacity-80">{vault.isOnline ? "Online" : "Offline"}</span>
                        </button>
                    ))}
                </div>
            </section>

            {!selectedVaultId ? (
                <section className="rounded-md bg-white p-5 shadow-md">
                    <p className="text-sm text-gray-600">Select a vault above to manage passwords.</p>
                </section>
            ) : null}

            {selectedVaultId && selectedVault && !selectedVault.isOnline ? (
                <section className="rounded-md bg-white p-5 shadow-md">
                    <p className="text-sm text-gray-600">
                        Selected vault is offline. Connect the vault to manage passwords.
                    </p>
                </section>
            ) : null}

            {selectedVaultId && selectedVault?.isOnline ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-md bg-white p-5 shadow-md">
                        <h2 className="text-xl font-semibold text-gray-800">{isEditing ? "Update password" : "Add password"}</h2>

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

                            <div className="flex flex-col gap-2 lg:col-span-2">
                                <input
                                    type="password"
                                    name="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder={isEditing ? "Enter new password" : "Enter password"}
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
                                disabled={isSubmitting || isLoadingVaults || !selectedVault?.isOnline}
                            >
                                {isSubmitting ? "Saving..." : isEditing ? "Update" : "Add"}
                            </button>

                            {isEditing ? (
                                <button type="button" className="rounded-sm border-2 px-4 py-2" onClick={resetForm}>
                                    Cancel edit
                                </button>
                            ) : null}

                            {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
                            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                        </div>
                    </form>

                    <section className="rounded-md bg-white p-5 shadow-md">
                        <h2 className="mb-4 text-xl font-semibold text-gray-800">Passwords</h2>
                        {isLoadingPasswords ? <p className="text-sm text-gray-500">Loading passwords...</p> : null}
                        {!isLoadingPasswords && passwords.length === 0 ? (
                            <p className="text-sm text-gray-500">No passwords for selected vault.</p>
                        ) : null}

                        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
                            {passwords.map((passwordDto) => (
                                <article
                                    key={passwordDto.passwordId}
                                    className="flex flex-col gap-3 rounded-md border border-gray-200 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-medium text-gray-900">{passwordDto.identifier}</p>
                                            <p className="text-sm text-gray-600">{passwordDto.domain}</p>
                                            <p className="text-xs text-gray-500">
                                                Updated {new Date(passwordDto.lastModified).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className="rounded-sm border px-2 py-1 text-sm"
                                                disabled={isSubmitting}
                                                onClick={() => handleEdit(passwordDto)}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="rounded-sm border border-red-300 px-2 py-1 text-sm text-red-600"
                                                disabled={isSubmitting}
                                                onClick={() => void handleDelete(passwordDto.passwordId)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 rounded bg-gray-50 p-2">
                                        <p className="max-w-full overflow-x-auto whitespace-nowrap font-mono text-sm text-gray-700">
                                            {revealedPasswords[passwordDto.passwordId] ?? "••••••••••••"}
                                        </p>

                                        <RippleButton
                                            type="button"
                                            variant="outline"
                                            className="rounded-sm border px-2 py-1 text-sm"
                                            disabled={isLoadingCiphertextId === passwordDto.passwordId}
                                            rippleColor="rgb(0, 0, 0, 0.7)"
                                            onClick={() => void handleRevealToggle(passwordDto.passwordId)}
                                        >
                                            {isLoadingCiphertextId === passwordDto.passwordId
                                                ? "Loading..."
                                                : revealedPasswords[passwordDto.passwordId]
                                                  ? "Hide"
                                                  : "Reveal"}
                                        </RippleButton>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null}
        </section>
    );
}
