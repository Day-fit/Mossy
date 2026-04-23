import { useEffect, useState } from 'react';
import {
	executeDeletePasswordRequest,
	executePasswordCiphertextRequest,
	executePasswordMetadataRequest,
	executeSavePasswordRequest,
	executeUpdatePasswordRequest,
	type PasswordMetadataDto,
	type ServerResponseDto,
} from '../../api/password.api.ts';
import { type UserVaultDto } from '../../api/vault.api.ts';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import { useEncryptionHook } from '../../hooks/useEncryptionHook.ts';
import VaultSelectorCard from './VaultSelectorCard.tsx';
import type {
	CiphertextPhase,
	PasswordFormState,
	StatusMessage,
} from './index.ts';
import PasswordFormCard from './PasswordFormCard.tsx';
import PasswordListCard from './PasswordListCard.tsx';
import { useVault } from '../../hooks/useVault.ts';
import { KeyNotFoundException } from '../../exception/KeyNotFoundException.ts';
import KeySyncModal from './KeySyncModal.tsx';

const INITIAL_FORM_STATE: PasswordFormState = {
	identifier: '',
	domain: '',
	password: '',
};

export default function PasswordHero() {
	const { encrypt, decrypt, isPinPresent } = useEncryptionHook();

	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);

	const [passwords, setPasswords] = useState<PasswordMetadataDto[]>([]);
	const [revealedPasswords, setRevealedPasswords] = useState<
		Record<string, string>
	>({});
	const [formState, setFormState] =
		useState<PasswordFormState>(INITIAL_FORM_STATE);
	const [editedPasswordId, setEditedPasswordId] = useState<string | null>(
		null
	);

	const { vaults, refreshVaults } = useVault();
	const [selectedVaultId, setSelectedVaultId] = useState('');

	const [isLoadingPasswords, setIsLoadingPasswords] =
		useState<boolean>(false);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [loadingCiphertextPhase, setLoadingCiphertextPhase] = useState<
		Record<string, CiphertextPhase>
	>({});
	const [lastAction, setLastAction] = useState<
		((pin: string) => void) | undefined
	>();

	const [status, setStatus] = useState<StatusMessage>(null);

	const selectedVault =
		vaults.find((vault) => vault.vaultId === selectedVaultId) ?? null;

	const isEditing = editedPasswordId !== null;
	const canManagePasswords = Boolean(
		selectedVaultId && selectedVault?.isOnline
	);

	const resetForm = () => {
		setFormState(INITIAL_FORM_STATE);
		setEditedPasswordId(null);
	};

	const resetPasswordView = () => {
		setPasswords([]);
		setRevealedPasswords({});
		setLoadingCiphertextPhase({});
	};

	const loadPasswords = async (vaultId: string) => {
		if (!vaultId) {
			resetPasswordView();
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
			setStatus({ type: 'error', message: 'Failed to load passwords' });
		} finally {
			setIsLoadingPasswords(false);
		}
	};

	// Load initial vault passwords only on mount or when vaults first become available
	useEffect(() => {
		if (vaults.length === 0 || selectedVaultId) return;

		const initialVault =
			vaults.find((vault) => vault.isOnline) ?? vaults[0];
		if (initialVault) {
			setSelectedVaultId(initialVault.vaultId);
			if (initialVault.isOnline) {
				void loadPasswords(initialVault.vaultId);
			} else {
				resetPasswordView();
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [vaults, selectedVaultId]);

	// Listen to cross-tab vault refresh events to reload current vault passwords
	useEffect(() => {
		const bc = new BroadcastChannel('vault_updates');
		bc.onmessage = (event) => {
			if (event.data === 'refresh' && selectedVaultId) {
				const currentVault = vaults.find(
					(v) => v.vaultId === selectedVaultId
				);
				if (currentVault?.isOnline) {
					void loadPasswords(selectedVaultId);
				}
			}
		};
		return () => bc.close();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedVaultId, vaults]);

	const handleSubmit = async () => {
		if (!selectedVaultId || !selectedVault?.isOnline) {
			setStatus({
				type: 'error',
				message: 'Select an online vault to save password',
			});
			return;
		}

		if (!(await isPinPresent(selectedVaultId))) {
			setLastAction(() => (_: string) => {
				void resumeSubmit();
			});
			setIsPinModalActive(true);
			return;
		}

		await resumeSubmit();
	};

	const resumeSubmit = async () => {
		setIsSubmitting(true);
		setStatus(null);

		try {
			const payload = {
				identifier: formState.identifier,
				domain: formState.domain,
				cipherText: await encrypt(formState.password, selectedVaultId),
				vaultId: selectedVaultId,
			};

			const response: ServerResponseDto = isEditing
				? await executeUpdatePasswordRequest({
						...payload,
						passwordId: editedPasswordId,
					})
				: await executeSavePasswordRequest(payload);

			setStatus({ type: 'success', message: response.message });
			resetForm();
			await refreshVaults();
		} catch (error) {
			setStatus({
				type: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Failed to save password data',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (passwordId: string) => {
		if (!selectedVaultId || !selectedVault?.isOnline) {
			return;
		}

		setIsSubmitting(true);
		setStatus(null);

		try {
			const response = await executeDeletePasswordRequest({
				passwordId,
				vaultId: selectedVaultId,
			});

			setStatus({ type: 'success', message: response.message });
			if (editedPasswordId === passwordId) {
				resetForm();
			}
			await refreshVaults();
		} catch (error) {
			setStatus({
				type: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Failed to delete password',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRevealToggle = async (passwordId: string) => {
		if (!selectedVaultId || !selectedVault?.isOnline) {
			return;
		}

		try {
			const shouldAskForPin = !(await isPinPresent(selectedVaultId));

			if (shouldAskForPin) {
				setLastAction(() => (_: string) => {
					void resumeRevealToggle(passwordId);
				});
				setIsPinModalActive(true);
				return;
			}
		} catch (error) {
			if (!(error instanceof KeyNotFoundException)) {
				throw error;
			}

			setIsKeySyncModalActive(true);
		}

		await resumeRevealToggle(passwordId);
	};

	const resumeRevealToggle = async (passwordId: string) => {
		if (revealedPasswords[passwordId]) {
			setRevealedPasswords((prev) => {
				const next = { ...prev };
				delete next[passwordId];
				return next;
			});
			return;
		}

		setLoadingCiphertextPhase((prevState) => ({
			...prevState,
			[passwordId]: 'Fetching',
		}));
		setStatus(null);

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
			setStatus({
				type: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Failed to reveal password',
			});
		} finally {
			setLoadingCiphertextPhase((prevState) => {
				const next = { ...prevState };
				delete next[passwordId];
				return next;
			});
		}
	};

	const handleEdit = (passwordDto: PasswordMetadataDto) => {
		setFormState({
			identifier: passwordDto.identifier,
			domain: passwordDto.domain,
			password: '',
		});
		setEditedPasswordId(passwordDto.passwordId);
		setStatus(null);
	};

	const handleFormChange = (
		field: keyof PasswordFormState,
		value: string
	) => {
		setFormState((prevState) => ({ ...prevState, [field]: value }));
	};

	const handleVaultSelect = async (vault: UserVaultDto) => {
		setSelectedVaultId(vault.vaultId);
		resetForm();
		setStatus(null);
		resetPasswordView();

		if (vault.isOnline) {
			await loadPasswords(vault.vaultId);
		}
	};

	return (
		<section className="w-full p-5">
			{isPinModalActive && (
				<PasswordPinModal
					vaultId={selectedVaultId}
					setIsPinModalActive={setIsPinModalActive}
					afterPinEntered={lastAction}
				/>
			)}

			{isKeySyncModalActive && (
				<KeySyncModal
					setIsKeySyncModalActive={setIsKeySyncModalActive}
				/>
			)}

			<VaultSelectorCard
				vaults={vaults}
				selectedVaultId={selectedVaultId}
				onSelectVault={(vault) => {
					void handleVaultSelect(vault);
				}}
			/>

			{!selectedVaultId ? (
				<section className="rounded-md bg-white p-5 shadow-md">
					<p className="text-sm text-gray-600">
						Select a vault above to manage passwords.
					</p>
				</section>
			) : null}

			{selectedVaultId && selectedVault && !selectedVault.isOnline ? (
				<section className="rounded-md bg-white p-5 shadow-md">
					<p className="text-sm text-gray-600">
						Selected vault is offline. Connect the vault to manage
						passwords.
					</p>
				</section>
			) : null}

			{canManagePasswords ? (
				<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
					<PasswordFormCard
						formState={formState}
						isEditing={isEditing}
						isSubmitting={isSubmitting}
						isVaultOnline={Boolean(selectedVault?.isOnline)}
						status={status}
						onSubmit={() => {
							void handleSubmit();
						}}
						onChange={handleFormChange}
						onCancelEdit={resetForm}
					/>

					<PasswordListCard
						passwords={passwords}
						revealedPasswords={revealedPasswords}
						loadingCiphertextPhase={loadingCiphertextPhase}
						isLoadingPasswords={isLoadingPasswords}
						isSubmitting={isSubmitting}
						onEdit={handleEdit}
						onDelete={(passwordId) => {
							void handleDelete(passwordId);
						}}
						onRevealToggle={(passwordId) => {
							void handleRevealToggle(passwordId);
						}}
					/>
				</div>
			) : null}
		</section>
	);
}
