import {
	executePasswordMetadataRequest,
	type PasswordMetadataDto,
} from '../../api/password.api.ts';
import PasswordListItem from './PasswordListItem.tsx';
import SshKeyListItem from './SshKeyListItem.tsx';
import TagsMenu from './tag/TagsMenu.tsx';
import { useSearchStore } from '../../store/searchStore.ts';
import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import SearchBar from './SearchBar.tsx';
import { MdAdd } from 'react-icons/md';
import PasswordEntryInput from './PasswordEntryInput.tsx';
import { usePasswordListActions } from './usePasswordListActions.tsx';

type PasswordListCardProps = {
	vaultId: string;
	isVaultOnline: boolean;
	refreshVaults: () => Promise<void>;
};

function PasswordListCard({
	vaultId,
	isVaultOnline,
	refreshVaults,
}: PasswordListCardProps) {
	const { query, selectedTagsId } = useSearchStore();
	const {
		isSubmitting,
		status,
		refreshToken,
		revealedPasswords,
		loadingCiphertextPhase,
		handleSavePassword,
		handleDelete,
		handleRevealToggle,
		handleDownloadSshKey,
		actionModals,
	} = usePasswordListActions({
		vaultId,
		isVaultOnline,
		refreshVaults,
	});

	const [passwords, setPasswords] = useState<PasswordMetadataDto[]>([]);
	const [isLoadingPasswords, setIsLoadingPasswords] = useState(false);
	const [isAddingPassword, setIsAddingPassword] = useState(false);

	useEffect(() => {
		if (!vaultId) {
			setPasswords([]);
			return;
		}
		void loadPasswords(vaultId);
	}, [vaultId, refreshToken]);

	useEffect(() => {
		setIsAddingPassword(false);
	}, [vaultId]);

	const loadPasswords = async (id: string) => {
		setIsLoadingPasswords(true);
		try {
			const next = await executePasswordMetadataRequest(id);
			setPasswords(
				next.sort(
					(a, b) =>
						new Date(b.lastModified).getTime() -
						new Date(a.lastModified).getTime()
				)
			);
		} catch {
			setPasswords([]);
		} finally {
			setIsLoadingPasswords(false);
		}
	};

	const filteredPasswordsByTags = useMemo(() => {
		if (!selectedTagsId || selectedTagsId.length === 0) return passwords;

		return passwords.filter((password) =>
			password.tags.some((tag) => selectedTagsId.includes(tag.tagId))
		);
	}, [passwords, selectedTagsId]);

	const fuse = useMemo(() => {
		return new Fuse(filteredPasswordsByTags, {
			keys: ['identifier', 'address'],
			threshold: 0.3,
			includeScore: true,
			ignoreLocation: true,
		});
	}, [filteredPasswordsByTags]);

	const results = useMemo(() => {
		if (!query || !query.trim())
			return filteredPasswordsByTags.map((item) => ({ item, score: 0 }));

		return fuse.search(query);
	}, [fuse, query, filteredPasswordsByTags]);

	return (
		<section className="rounded-md bg-white p-5 shadow-md w-full">
			{actionModals}

			<div
				className={
					'flex flex-wrap justify-between items-center w-full gap-3 relative mb-4'
				}
			>
				<h2 className="text-xl font-semibold text-emerald-900">
					Passwords
				</h2>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setIsAddingPassword(true)}
						disabled={isAddingPassword || isSubmitting}
						className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-sm text-gray-500 transition-all hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<MdAdd size={16} />
						Add password
					</button>

					<TagsMenu />
				</div>
			</div>

			<SearchBar />

			{status?.type === 'success' ? (
				<p className="mt-2 text-sm text-emerald-700">
					{status.message}
				</p>
			) : null}

			{status?.type === 'error' ? (
				<p className="mt-2 text-sm text-red-600">{status.message}</p>
			) : null}

			{(query || selectedTagsId.length > 0) && (
				<p className={'text-sm text-gray-500 mt-1'}>
					Showing {results.length} of {passwords.length} results.
				</p>
			)}

			{isAddingPassword ? (
				<div className="mt-5">
					<PasswordEntryInput
						isSubmitting={isSubmitting}
						isVaultOnline={isVaultOnline}
						onSubmit={(formState) =>
							handleSavePassword(formState, undefined, {
								onSaved: () => setIsAddingPassword(false),
							})
						}
						onCancel={() => setIsAddingPassword(false)}
					/>
				</div>
			) : null}

			<div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1 mt-5">
				{!isLoadingPasswords ? (
					results.length > 0 ? (
						results.map((result) => {
							const password = result.item;
							const phase =
								loadingCiphertextPhase[password.passwordId];

							if (password.passwordType === 'SSH_KEY') {
								return (
									<SshKeyListItem
										key={password.passwordId}
										passwordDto={password}
										setPasswordDto={setPasswords}
										phase={phase}
										isSubmitting={isSubmitting}
										isVaultOnline={isVaultOnline}
										onSave={handleSavePassword}
										onDelete={(id) => void handleDelete(id)}
										onDownloadSshKey={(password) =>
											void handleDownloadSshKey(password)
										}
									/>
								);
							}

							return (
								<PasswordListItem
									key={password.passwordId}
									passwordDto={password}
									setPasswordDto={setPasswords}
									revealedPassword={
										revealedPasswords[password.passwordId]
									}
									phase={phase}
									isSubmitting={isSubmitting}
									isVaultOnline={isVaultOnline}
									onSave={handleSavePassword}
									onDelete={(id) => void handleDelete(id)}
									onRevealToggle={(id) =>
										void handleRevealToggle(id)
									}
								/>
							);
						})
					) : (
						<p className={'text-sm text-gray-500'}>
							{query || selectedTagsId.length > 0
								? 'No results found.'
								: 'No passwords for selected vault.'}
						</p>
					)
				) : (
					<p className="text-sm text-gray-500">
						Loading passwords...
					</p>
				)}
			</div>
		</section>
	);
}

export default PasswordListCard;
