import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
	executeDeletePasswordRequest,
	executePasswordCiphertextRequest,
	executePasswordMetadataRequest,
	executeSavePasswordRequest,
	executeUpdatePasswordRequest,
	type PasswordMetadataDto,
	type ServerResponseDto,
} from '../../api/password.api.ts';
import {
	executeUserVaultsRequest,
	type UserVaultDto,
} from '../../api/vault.api.ts';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import { useEncryptionContext } from '../../context/EncryptionContext.tsx';
import PasswordVaultSelector from './PasswordVaultSelector.tsx';
import PasswordEditorForm from './PasswordEditorForm.tsx';
import PasswordListSection from './PasswordListSection.tsx';

export default function PasswordHero() {
	const { encrypt, decrypt, isPinPresent } = useEncryptionContext();

	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const [passwords, setPasswords] = useState<PasswordMetadataDto[]>([]);
	const [revealedPasswords, setRevealedPasswords] = useState<
		Record<string, string>
	>({});

	const [identifier, setIdentifier] = useState('');
	const [domain, setDomain] = useState('');
	const [password, setPassword] = useState('');
	const [editedPasswordId, setEditedPasswordId] = useState<string | null>(
		null
	);

	const [vaults, setVaults] = useState<UserVaultDto[]>([]);
	const [selectedVaultId, setSelectedVaultId] = useState('');

	const [isLoadingVaults, setIsLoadingVaults] = useState<boolean>(true);
	const [isLoadingPasswords, setIsLoadingPasswords] =
		useState<boolean>(false);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [loadingCiphertextPhase, setLoadingCiphertextPhase] = useState<
		Record<string, 'Fetching' | 'Decrypting'>
	>({});

	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [pendingRevealPasswordId, setPendingRevealPasswordId] = useState<
		string | null
	>(null);
	const [pendingSubmitAfterPin, setPendingSubmitAfterPin] = useState(false);

	const selectedVault = useMemo(
		() =>
			vaults.find((vault) => {
				console.log(vault.vaultId, selectedVaultId, vault);
				return vault.vaultId === selectedVaultId;
			}) ?? null,
		[vaults, selectedVaultId]
	);

	const isEditing = editedPasswordId !== null;

	const resetForm = () => {
		setIdentifier('');
		setDomain('');
		setPassword('');
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
			setErrorMessage('Failed to load passwords');
		} finally {
			setIsLoadingPasswords(false);
		}
	};

	useEffect(() => {
		const loadVaults = async () => {
			try {
				const nextVaults = await executeUserVaultsRequest();
				setVaults(nextVaults);
				console.log(nextVaults);

				const firstOnlineVault = nextVaults.find(
					(vault) => vault.isOnline
				);
				setSelectedVaultId(
					firstOnlineVault?.vaultId ?? nextVaults[0]?.vaultId ?? ''
				);
				setErrorMessage(null);
			} catch {
				setVaults([]);
				setSelectedVaultId('');
				setErrorMessage('Failed to load your vaults');
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

		if (!isPinPresent(selectedVaultId)) {
			setPendingSubmitAfterPin(true);
			setIsPinModalActive(true);
			setIsSubmitting(false);
			return;
		}

		if (!selectedVaultId || !selectedVault?.isOnline) {
			setErrorMessage('Select an online vault to save password');
			return;
		}

		setIsSubmitting(true);
		setSuccessMessage(null);
		setErrorMessage(null);

		try {
			await submitPasswordData();
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Failed to save password data'
			);
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
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Failed to delete password'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRevealToggle = async (passwordId: string) => {
		if (!selectedVaultId || !selectedVault?.isOnline) {
			return;
		}

		if (!isPinPresent(selectedVaultId)) {
			setPendingRevealPasswordId(passwordId);
			setIsPinModalActive(true);
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

		setLoadingCiphertextPhase((prevState) => {
			const next = { ...prevState };
			next[passwordId] = 'Fetching';
			return next;
		});
		setErrorMessage(null);

		try {
			const response = await executePasswordCiphertextRequest(
				passwordId,
				selectedVaultId
			);

			setLoadingCiphertextPhase((prevState) => {
				const next = { ...prevState };
				next[passwordId] = 'Decrypting';
				return next;
			});

			const decryptedPassword = await decrypt(
				response.ciphertext,
				selectedVaultId
			);
			setRevealedPasswords((prev) => ({
				...prev,
				[passwordId]: decryptedPassword,
			}));
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Failed to reveal password'
			);
		} finally {
			setLoadingCiphertextPhase((prevState) => {
				const next = { ...prevState };
				delete next[passwordId];
				return next;
			});
		}
	};

	const handleEdit = (passwordDto: PasswordMetadataDto) => {
		setIdentifier(passwordDto.identifier);
		setDomain(passwordDto.domain);
		setPassword('');
		setEditedPasswordId(passwordDto.passwordId);
		setSuccessMessage(null);
		setErrorMessage(null);
	};

	const handleVaultSelect = (vaultId: string) => {
		setSelectedVaultId(vaultId);
		resetForm();
		setSuccessMessage(null);
		setErrorMessage(null);
		setPendingRevealPasswordId(null);
		setPendingSubmitAfterPin(false);
	};

	const submitPasswordData = async () => {
		const payload = {
			identifier,
			domain,
			cipherText: await encrypt(password, selectedVaultId),
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
	};

	return (
		<motion.section
			className="w-full px-4 py-5 sm:px-5"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
		>
			{isPinModalActive && (
				<PasswordPinModal
					vaultId={selectedVaultId}
					setIsPinModalActive={setIsPinModalActive}
					afterPinEntered={async () => {
						if (pendingSubmitAfterPin) {
							setPendingSubmitAfterPin(false);
							setIsSubmitting(true);
							setSuccessMessage(null);
							setErrorMessage(null);
							try {
								await submitPasswordData();
							} catch (error) {
								setErrorMessage(
									error instanceof Error
										? error.message
										: 'Failed to save password data'
								);
							} finally {
								setIsSubmitting(false);
							}
						}

						if (pendingRevealPasswordId) {
							const toReveal = pendingRevealPasswordId;
							setPendingRevealPasswordId(null);
							await handleRevealToggle(toReveal);
						}
					}}
				/>
			)}

			<div className="mx-auto max-w-7xl space-y-6">
				<PasswordVaultSelector
					isLoadingVaults={isLoadingVaults}
					vaults={vaults}
					selectedVaultId={selectedVaultId}
					onSelect={handleVaultSelect}
				/>

				{!selectedVaultId ? (
					<section className="rounded-md bg-white p-4 shadow-md sm:p-5">
						<p className="text-sm text-gray-600">
							Select a vault above to manage passwords.
						</p>
					</section>
				) : null}

				{selectedVaultId && selectedVault && !selectedVault.isOnline ? (
					<section className="rounded-md bg-white p-4 shadow-md sm:p-5">
						<p className="text-sm text-gray-600">
							Selected vault is offline. Connect the vault to
							manage passwords.
						</p>
					</section>
				) : null}

				{selectedVaultId && selectedVault?.isOnline ? (
					<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
						<PasswordEditorForm
							identifier={identifier}
							domain={domain}
							password={password}
							isEditing={isEditing}
							isSubmitting={isSubmitting}
							isLoadingVaults={isLoadingVaults}
							isVaultOnline={Boolean(selectedVault?.isOnline)}
							successMessage={successMessage}
							errorMessage={errorMessage}
							onIdentifierChange={setIdentifier}
							onDomainChange={setDomain}
							onPasswordChange={setPassword}
							onSubmit={handleSubmit}
							onCancelEdit={resetForm}
						/>

						<PasswordListSection
							passwords={passwords}
							revealedPasswords={revealedPasswords}
							isLoadingPasswords={isLoadingPasswords}
							isSubmitting={isSubmitting}
							loadingCiphertextPhase={loadingCiphertextPhase}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onRevealToggle={handleRevealToggle}
						/>
					</div>
				) : null}
			</div>
		</motion.section>
	);
}
