import { useEffect, useState } from 'react';
import {
	executeDeletePasswordRequest,
	executePasswordCiphertextRequest,
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
	SavePasswordResult,
	StatusMessage,
} from './index.ts';
import PasswordListCard from './PasswordListCard.tsx';
import { useVault } from '../../hooks/useVault.ts';
import { KeyNotFoundException } from '../../exception/KeyNotFoundException.ts';
import KeySyncModal from './KeySyncModal.tsx';
import { useVaultStore } from '../../store/vaultStore.ts';
import {
	parseSecretPayload,
	serializeSecretPayload,
} from './secretPayload.ts';

export default function PasswordHero() {
	const { encrypt, decrypt, isPinPresent } = useEncryptionHook();

	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);
	const [revealedPasswords, setRevealedPasswords] = useState<
		Record<string, string>
	>({});
	const { selectedVaultId, setSelectedVaultId } = useVaultStore();

	const { vaults, refreshVaults } = useVault();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [loadingCiphertextPhase, setLoadingCiphertextPhase] = useState<
		Record<string, CiphertextPhase>
	>({});
	const [lastAction, setLastAction] = useState<
		((pin: string) => void) | undefined
	>();

	const [status, setStatus] = useState<StatusMessage>(null);
	const [passwordListRefreshToken, setPasswordListRefreshToken] = useState(0);

	const selectedVault =
		vaults.find((v) => v.vaultId === selectedVaultId) ?? null;

	const canManagePasswords = Boolean(
		selectedVaultId && selectedVault?.isOnline
	);

	const resetPasswordView = () => {
		setRevealedPasswords({});
		setLoadingCiphertextPhase({});
	};

	useEffect(() => {
		if (vaults.length === 0 || selectedVaultId) return;

		const initial = vaults.find((v) => v.isOnline) ?? vaults[0];
		if (!initial) return;

		setSelectedVaultId(initial.vaultId);
		resetPasswordView();
	}, [vaults, selectedVaultId, setSelectedVaultId]);

	useEffect(() => {
		const bc = new BroadcastChannel('vault_updates');

		bc.onmessage = (event) => {
			if (event.data !== 'refresh' || !selectedVaultId) return;

			const vault = vaults.find((v) => v.vaultId === selectedVaultId);
			if (!vault?.isOnline) return;
			setPasswordListRefreshToken((prev) => prev + 1);
		};

		return () => bc.close();
	}, [selectedVaultId, vaults]);

	const runWithVaultKeySync = async <T,>(
		vaultId: string,
		action: () => Promise<T>
	): Promise<
		| {
				type: 'completed';
				value: T;
		  }
		| { type: 'deferred' }
	> => {
		try {
			if (!(await isPinPresent(vaultId))) {
				setLastAction(() => () => {
					void action();
				});
				setIsPinModalActive(true);
				return { type: 'deferred' };
			}
		} catch (error) {
			if (error instanceof KeyNotFoundException) {
				setLastAction(() => () => {
					void action();
				});
				setIsKeySyncModalActive(true);
				return { type: 'deferred' };
			}
			throw error;
		}

		return { type: 'completed', value: await action() };
	};

	const resumeSavePassword = async (
		formState: PasswordFormState,
		passwordId?: string
	): Promise<SavePasswordResult> => {
		setIsSubmitting(true);
		setStatus(null);

		try {
			const basePayload = {
				identifier: formState.identifier,
				address: formState.address,
				cipherText: await encrypt(
					serializeSecretPayload(formState),
					selectedVaultId
				),
				vaultId: selectedVaultId,
			};

			const response: ServerResponseDto = passwordId
				? await executeUpdatePasswordRequest({
						...basePayload,
						passwordId,
					})
				: await executeSavePasswordRequest({
						...basePayload,
						passwordType: formState.passwordType,
					});

			setStatus({ type: 'success', message: response.message });
			await refreshVaults();
			setPasswordListRefreshToken((prev) => prev + 1);
			return 'saved';
		} catch (error) {
			setStatus({
				type: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Failed to save password data',
			});
			return 'failed';
		} finally {
			setIsSubmitting(false);
		}
	};

	const getSshKeyFilename = (
		password: PasswordMetadataDto,
		keyType: 'private' | 'public'
	) => {
		const fallback = password.passwordId;
		const rawName = password.identifier || password.address || fallback;
		const safeName =
			rawName
				.trim()
				.replace(/[^a-zA-Z0-9._-]+/g, '-')
				.replace(/^-+|-+$/g, '') || fallback;

		if (keyType === 'public') {
			return safeName.endsWith('.pub') ? safeName : `${safeName}.pub`;
		}

		return safeName.endsWith('.key') || safeName.endsWith('.pem')
			? safeName
			: `${safeName}.key`;
	};

	const downloadTextFile = (filename: string, content: string) => {
		const url = URL.createObjectURL(
			new Blob([content], { type: 'application/octet-stream' })
		);
		const link = document.createElement('a');

		link.href = url;
		link.download = filename;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
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
			const secretPayload = parseSecretPayload(decrypted);

			if (secretPayload.kind !== 'PASSWORD') {
				throw new Error('Selected entry does not contain a password.');
			}

			setRevealedPasswords((prev) => ({
				...prev,
				[passwordId]: secretPayload.password,
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

	const resumeDownloadSshKey = async (password: PasswordMetadataDto) => {
		setLoadingCiphertextPhase((prev) => ({
			...prev,
			[password.passwordId]: 'Fetching',
		}));

		setStatus(null);

		try {
			const response = await executePasswordCiphertextRequest(
				password.passwordId,
				selectedVaultId
			);

			setLoadingCiphertextPhase((prev) => ({
				...prev,
				[password.passwordId]: 'Decrypting',
			}));

			const decrypted = await decrypt(
				response.ciphertext,
				selectedVaultId
			);
			const secretPayload = parseSecretPayload(decrypted);

			if (secretPayload.kind !== 'SSH') {
				throw new Error('Selected entry does not contain SSH keys.');
			}

			downloadTextFile(
				getSshKeyFilename(password, 'private'),
				secretPayload.privateKey
			);
			downloadTextFile(
				getSshKeyFilename(password, 'public'),
				secretPayload.publicKey
			);
		} catch (error) {
			setStatus({
				type: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Failed to download SSH key',
			});
		} finally {
			setLoadingCiphertextPhase((prev) => {
				const next = { ...prev };
				delete next[password.passwordId];
				return next;
			});
		}
	};

	const handleSavePassword = async (
		formState: PasswordFormState,
		passwordId?: string
	): Promise<SavePasswordResult> => {
		if (!selectedVaultId || !selectedVault?.isOnline) {
			setStatus({
				type: 'error',
				message: 'Select an online vault to save password',
			});
			return 'failed';
		}

		try {
			const result = await runWithVaultKeySync(selectedVaultId, () =>
				resumeSavePassword(formState, passwordId)
			);

			return result.type === 'deferred' ? 'deferred' : result.value;
		} catch (error) {
			setStatus({
				type: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Failed to save password data',
			});
			return 'failed';
		}
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

			await refreshVaults();
			setPasswordListRefreshToken((prev) => prev + 1);
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

	const handleDownloadSshKey = async (password: PasswordMetadataDto) => {
		if (!selectedVaultId || !selectedVault?.isOnline) return;

		await runWithVaultKeySync(selectedVaultId, () =>
			resumeDownloadSshKey(password)
		);
	};

	const handleVaultSelect = async (vault: UserVaultDto) => {
		setSelectedVaultId(vault.vaultId);
		setStatus(null);
		resetPasswordView();

		if (!vault.isOnline) return;
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
				<div className="flex flex-col gap-6">
					<PasswordListCard
						vaultId={selectedVaultId}
						refreshToken={passwordListRefreshToken}
						revealedPasswords={revealedPasswords}
						loadingCiphertextPhase={loadingCiphertextPhase}
						isSubmitting={isSubmitting}
						isVaultOnline={Boolean(selectedVault?.isOnline)}
						status={status}
						onSave={handleSavePassword}
						onDelete={(id) => void handleDelete(id)}
						onRevealToggle={(id) => void handleRevealToggle(id)}
						onDownloadSshKey={(password) =>
							void handleDownloadSshKey(password)
						}
					/>
				</div>
			) : null}
		</section>
	);
}
