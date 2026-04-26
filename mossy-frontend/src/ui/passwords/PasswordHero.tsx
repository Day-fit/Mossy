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

	const [isLoadingPasswords, setIsLoadingPasswords] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loadingCiphertextPhase, setLoadingCiphertextPhase] = useState<
		Record<string, CiphertextPhase>
	>({});
	const [lastAction, setLastAction] = useState<
		((pin: string) => void) | undefined
	>();

	const [status, setStatus] = useState<StatusMessage>(null);

	const selectedVault =
		vaults.find((v) => v.vaultId === selectedVaultId) ?? null;

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
			const next = await executePasswordMetadataRequest(vaultId);

			setPasswords(
				next.sort((a, b) => {
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

	useEffect(() => {
		if (vaults.length === 0 || selectedVaultId) return;

		const initial = vaults.find((v) => v.isOnline) ?? vaults[0];
		if (!initial) return;

		setSelectedVaultId(initial.vaultId);

		if (initial.isOnline) {
			void loadPasswords(initial.vaultId);
			return;
		}

		resetPasswordView();
	}, [vaults, selectedVaultId]);

	useEffect(() => {
		const bc = new BroadcastChannel('vault_updates');

		bc.onmessage = (event) => {
			if (event.data !== 'refresh' || !selectedVaultId) return;

			const vault = vaults.find((v) => v.vaultId === selectedVaultId);
			if (!vault?.isOnline) return;

			void loadPasswords(selectedVaultId);
		};

		return () => bc.close();
	}, [selectedVaultId, vaults]);

	const runWithVaultKeySync = async (
		vaultId: string,
		action: () => Promise<void>
	) => {
		try {
			if (!(await isPinPresent(vaultId))) {
				setLastAction(() => (_: string) => {
					void action();
				});
				setIsPinModalActive(true);
				return;
			}
		} catch (error) {
			if (error instanceof KeyNotFoundException) {
				setLastAction(() => (_: string) => {
					void action();
				});
				setIsKeySyncModalActive(true);
				return;
			}
			throw error;
		}

		await action();
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

	const resumeRevealToggle = async (passwordId: string) => {
		if (revealedPasswords[passwordId]) {
			setRevealedPasswords((prev) => {
				const next = { ...prev };
				delete next[passwordId];
				return next;
			});
			return;
		}

		setLoadingCiphertextPhase((prev) => ({
			...prev,
			[passwordId]: 'Fetching',
		}));

		setStatus(null);

		try {
			const response = await executePasswordCiphertextRequest(
				passwordId,
				selectedVaultId
			);

			setLoadingCiphertextPhase((prev) => ({
				...prev,
				[passwordId]: 'Decrypting',
			}));

			const decrypted = await decrypt(
				response.ciphertext,
				selectedVaultId
			);

			setRevealedPasswords((prev) => ({
				...prev,
				[passwordId]: decrypted,
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
			setLoadingCiphertextPhase((prev) => {
				const next = { ...prev };
				delete next[passwordId];
				return next;
			});
		}
	};

	const handleSubmit = async () => {
		if (!selectedVaultId || !selectedVault?.isOnline) {
			setStatus({
				type: 'error',
				message: 'Select an online vault to save password',
			});
			return;
		}

		await runWithVaultKeySync(selectedVaultId, resumeSubmit);
	};

	const handleDelete = async (passwordId: string) => {
		if (!selectedVaultId || !selectedVault?.isOnline) return;

		setIsSubmitting(true);
		setStatus(null);

		try {
			const response = await executeDeletePasswordRequest({
				passwordId,
				vaultId: selectedVaultId,
			});

			setStatus({ type: 'success', message: response.message });

			if (editedPasswordId === passwordId) resetForm();

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
		if (!selectedVaultId || !selectedVault?.isOnline) return;

		await runWithVaultKeySync(selectedVaultId, () =>
			resumeRevealToggle(passwordId)
		);
	};

	const handleEdit = (dto: PasswordMetadataDto) => {
		setFormState({
			identifier: dto.identifier,
			domain: dto.domain,
			password: '',
		});

		setEditedPasswordId(dto.passwordId);
		setStatus(null);
	};

	const handleFormChange = (
		field: keyof PasswordFormState,
		value: string
	) => {
		setFormState((prev) => ({ ...prev, [field]: value }));
	};

	const handleVaultSelect = async (vault: UserVaultDto) => {
		setSelectedVaultId(vault.vaultId);
		resetForm();
		setStatus(null);
		resetPasswordView();

		if (!vault.isOnline) return;

		await loadPasswords(vault.vaultId);
	};

	return (
		<section className="w-full p-5 flex flex-col gap-6">
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
					vaultId={selectedVaultId}
				/>
			)}

			<VaultSelectorCard
				vaults={vaults}
				selectedVaultId={selectedVaultId}
				onSelectVault={(vault) => void handleVaultSelect(vault)}
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
						onSubmit={() => void handleSubmit()}
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
						onDelete={(id) => void handleDelete(id)}
						onRevealToggle={(id) => void handleRevealToggle(id)}
					/>
				</div>
			) : null}
		</section>
	);
}
