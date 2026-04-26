import { motion, type Variants } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import RippleButton from '../layout/RippleButton.tsx';
import {
	executeCreateVaultRequest,
	executeDeleteVaultRequest,
	executeUpdateVaultRequest,
} from '../../api/vault.api.ts';
import VaultCard from './VaultCard.tsx';
import AddVaultModal from './AddVaultModal.tsx';
import VaultActionModal from './VaultActionModal.tsx';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import { useEncryptionHook } from '../../hooks/useEncryptionHook.ts';
import { useVault } from '../../hooks/useVault.ts';

type CreatedVaultState = {
	vaultId: string;
	apiKey: string;
} | null;

type RenameState = {
	vaultId: string;
	currentName: string;
} | null;

type DeleteState = {
	vaultId: string;
	vaultName: string;
} | null;

export default function VaultHero() {
	const { vaults, refreshVaults, isLoading } = useVault();
	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const [vaultName, setVaultName] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [createdVault, setCreatedVault] = useState<CreatedVaultState>(null);
	const [renameState, setRenameState] = useState<RenameState>(null);
	const [renameValue, setRenameValue] = useState('');
	const [deleteState, setDeleteState] = useState<DeleteState>(null);
	const { saveKey } = useEncryptionHook();

	const containerVariants: Variants = {
		hidden: { opacity: 0, y: 20 },
		show: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.4,
				ease: 'easeOut',
				staggerChildren: 0.08,
			},
		},
	};

	const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);
		setSuccessMessage(null);
		setErrorMessage(null);

		try {
			const response = await executeCreateVaultRequest(vaultName);
			setCreatedVault({
				vaultId: response.vaultId,
				apiKey: response.apiKey,
			});
			setIsPinModalActive(true);

			setSuccessMessage('Vault created successfully');
			setVaultName('');
			await refreshVaults();
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Failed to create vault'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const openRenameModal = (vaultId: string, currentName: string) => {
		setRenameState({ vaultId, currentName });
		setRenameValue(currentName);
	};

	const handleRename = async () => {
		if (!renameState) {
			return;
		}
		const nextName = renameValue.trim();
		if (!nextName || nextName === renameState.currentName.trim()) {
			setRenameState(null);
			return;
		}

		setIsSubmitting(true);
		setSuccessMessage(null);
		setErrorMessage(null);
		try {
			const response = await executeUpdateVaultRequest(
				renameState.vaultId,
				nextName
			);
			setSuccessMessage(response.message);
			await refreshVaults();
			setRenameState(null);
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Failed to rename vault'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteState) {
			return;
		}

		setIsSubmitting(true);
		setSuccessMessage(null);
		setErrorMessage(null);
		try {
			const response = await executeDeleteVaultRequest(
				deleteState.vaultId
			);
			setSuccessMessage(response.message);
			await refreshVaults();
			setDeleteState(null);
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Failed to delete vault'
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="w-full px-4 py-5">
			<motion.section
				className="mx-auto max-w-7xl space-y-6"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				{isPinModalActive && createdVault?.vaultId && (
					<PasswordPinModal
						setIsPinModalActive={setIsPinModalActive}
						vaultId={createdVault.vaultId}
						afterPinEntered={async (pin) =>
							await saveKey(createdVault.vaultId, pin)
						}
					/>
				)}

				<motion.div className="rounded-xl bg-white p-6 shadow-md">
					<h2 className="mb-2 text-3xl font-semibold text-gray-900">
						Vaults
					</h2>
					<p className="mb-6 text-sm text-gray-600">
						Manage your existing vaults and create new vault
						credentials.
					</p>

					<form
						onSubmit={handleCreate}
						className="grid gap-3 sm:grid-cols-[1fr_auto]"
					>
						<input
							type="text"
							value={vaultName}
							onChange={(event) =>
								setVaultName(event.target.value)
							}
							placeholder="Vault name"
							className="rounded-md border border-gray-200 px-3 py-2"
							minLength={1}
							maxLength={80}
							required
						/>
						<RippleButton
							type="submit"
							className="px-5 py-2 text-white"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Saving...' : 'Add vault'}
						</RippleButton>
					</form>

					{successMessage ? (
						<p className="mt-3 text-sm text-emerald-700">
							{successMessage}
						</p>
					) : null}
					{errorMessage ? (
						<p className="mt-3 text-sm text-red-600">
							{errorMessage}
						</p>
					) : null}
				</motion.div>

				<motion.div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{isLoading ? (
						<p className="text-sm text-gray-500">
							Loading vaults...
						</p>
					) : null}
					{!isLoading && vaults.length === 0 ? (
						<p className="text-sm text-gray-500">
							No vaults available.
						</p>
					) : null}
					{vaults.map((vault) => (
						<VaultCard
							key={vault.vaultId}
							vaultId={vault.vaultId}
							vaultName={vault.vaultName}
							isOnline={vault.isOnline}
							lastSeenAt={vault.lastSeenAt}
							onRename={() =>
								openRenameModal(vault.vaultId, vault.vaultName)
							}
							onDelete={() =>
								setDeleteState({
									vaultId: vault.vaultId,
									vaultName: vault.vaultName,
								})
							}
						/>
					))}
				</motion.div>
			</motion.section>

			{createdVault && !isPinModalActive ? (
				<AddVaultModal
					vaultId={createdVault.vaultId}
					apiKey={createdVault.apiKey}
					onClose={() => setCreatedVault(null)}
				/>
			) : null}

			{renameState ? (
				<VaultActionModal
					title="Rename vault"
					description="Provide a new vault name."
					confirmLabel="Save"
					onClose={() => setRenameState(null)}
					onConfirm={() => void handleRename()}
					confirmDisabled={isSubmitting}
				>
					<label
						className="mb-2 block text-xs font-medium text-gray-600"
						htmlFor="vault-rename-input"
					>
						New name
					</label>
					<input
						id="vault-rename-input"
						type="text"
						value={renameValue}
						onChange={(event) => setRenameValue(event.target.value)}
						className="w-full rounded-md border border-gray-200 px-3 py-2"
						minLength={1}
						maxLength={80}
						required
					/>
				</VaultActionModal>
			) : null}

			{deleteState ? (
				<VaultActionModal
					title="Delete vault"
					description={`Delete "${deleteState.vaultName}"? This action cannot be undone.`}
					confirmLabel={isSubmitting ? 'Deleting...' : 'Delete'}
					onClose={() => setDeleteState(null)}
					onConfirm={() => void handleDelete()}
					confirmDisabled={isSubmitting}
				/>
			) : null}
		</section>
	);
}
