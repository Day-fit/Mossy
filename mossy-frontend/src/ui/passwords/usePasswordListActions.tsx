import { useEffect, useState } from 'react';
import {
	executeDeletePasswordRequest,
	executePasswordCiphertextRequest,
	executeSavePasswordRequest,
	executeUpdatePasswordRequest,
	type PasswordMetadataDto,
	type ServerResponseDto,
} from '../../api/password.api.ts';
import type {
	CiphertextPhase,
	PasswordFormState,
	SavePasswordResult,
	StatusMessage,
} from './index.ts';
import { useEncryptionHook } from '../../hooks/useEncryptionHook.ts';
import { KeyNotFoundException } from '../../exception/KeyNotFoundException.ts';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import KeySyncModal from './KeySyncModal.tsx';
import { parseSecretPayload, serializeSecretPayload } from './secretPayload.ts';
import { downloadTextFile, getSshKeyFilename } from './sshKeyDownload.ts';

type UsePasswordListActionsOptions = {
	vaultId: string;
	isVaultOnline: boolean;
	refreshVaults: () => Promise<void>;
};

type SavePasswordOptions = {
	onSaved?: () => void;
};

export function usePasswordListActions({
	vaultId,
	isVaultOnline,
	refreshVaults,
}: UsePasswordListActionsOptions) {
	const { encrypt, decrypt, isPinPresent } = useEncryptionHook();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [status, setStatus] = useState<StatusMessage>(null);
	const [refreshToken, setRefreshToken] = useState(0);
	const [revealedPasswords, setRevealedPasswords] = useState<
		Record<string, string>
	>({});
	const [loadingCiphertextPhase, setLoadingCiphertextPhase] = useState<
		Record<string, CiphertextPhase>
	>({});
	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);
	const [lastAction, setLastAction] = useState<
		((pin: string) => void) | undefined
	>();

	useEffect(() => {
		setStatus(null);
		setRevealedPasswords({});
		setLoadingCiphertextPhase({});
	}, [vaultId]);

	useEffect(() => {
		const bc = new BroadcastChannel('vault_updates');

		bc.onmessage = (event) => {
			if (event.data !== 'refresh' || !vaultId || !isVaultOnline) return;
			setRefreshToken((prev) => prev + 1);
		};

		return () => bc.close();
	}, [vaultId, isVaultOnline]);

	const runWithVaultKeySync = async <T,>(
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
		passwordId?: string,
		options?: SavePasswordOptions
	): Promise<SavePasswordResult> => {
		setIsSubmitting(true);
		setStatus(null);

		try {
			const basePayload = {
				identifier: formState.identifier,
				address: formState.address,
				cipherText: await encrypt(
					serializeSecretPayload(formState),
					vaultId
				),
				vaultId,
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
			setRefreshToken((prev) => prev + 1);
			options?.onSaved?.();
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

	const handleSavePassword = async (
		formState: PasswordFormState,
		passwordId?: string,
		options?: SavePasswordOptions
	): Promise<SavePasswordResult> => {
		if (!vaultId || !isVaultOnline) {
			setStatus({
				type: 'error',
				message: 'Select an online vault to save password',
			});
			return 'failed';
		}

		try {
			const result = await runWithVaultKeySync(() =>
				resumeSavePassword(formState, passwordId, options)
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
		if (!vaultId || !isVaultOnline) return;

		setIsSubmitting(true);
		setStatus(null);

		try {
			const response = await executeDeletePasswordRequest({
				passwordId,
				vaultId,
			});

			setStatus({ type: 'success', message: response.message });
			await refreshVaults();
			setRefreshToken((prev) => prev + 1);
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
				vaultId
			);

			setLoadingCiphertextPhase((prev) => ({
				...prev,
				[passwordId]: 'Decrypting',
			}));

			const decrypted = await decrypt(response.ciphertext, vaultId);
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

	const handleRevealToggle = async (passwordId: string) => {
		if (!vaultId || !isVaultOnline) return;

		await runWithVaultKeySync(() => resumeRevealToggle(passwordId));
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
				vaultId
			);

			setLoadingCiphertextPhase((prev) => ({
				...prev,
				[password.passwordId]: 'Decrypting',
			}));

			const decrypted = await decrypt(response.ciphertext, vaultId);
			const secretPayload = parseSecretPayload(decrypted);

			if (secretPayload.kind !== 'SSH') {
				throw new Error('Selected entry does not contain SSH keys.');
			}

			downloadTextFile(
				getSshKeyFilename(password, 'private'),
				secretPayload.privateKey
			);

			if (secretPayload.publicKey) {
				downloadTextFile(
					getSshKeyFilename(password, 'public'),
					secretPayload.publicKey
				);
			}
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

	const handleDownloadSshKey = async (password: PasswordMetadataDto) => {
		if (!vaultId || !isVaultOnline) return;

		await runWithVaultKeySync(() => resumeDownloadSshKey(password));
	};

	return {
		isSubmitting,
		status,
		refreshToken,
		revealedPasswords,
		loadingCiphertextPhase,
		handleSavePassword,
		handleDelete,
		handleRevealToggle,
		handleDownloadSshKey,
		actionModals: (
			<>
				{isPinModalActive && (
					<PasswordPinModal
						vaultId={vaultId}
						setIsPinModalActive={setIsPinModalActive}
						afterPinEntered={lastAction}
					/>
				)}

				{isKeySyncModalActive && (
					<KeySyncModal
						setIsKeySyncModalActive={setIsKeySyncModalActive}
						vaultId={vaultId}
					/>
				)}
			</>
		),
	};
}
