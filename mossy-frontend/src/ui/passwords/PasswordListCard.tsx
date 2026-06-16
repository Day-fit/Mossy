import {
	executePasswordMetadataRequest,
	type PasswordMetadataDto,
} from '../../api/password.api.ts';
import type { CiphertextPhase } from './index.ts';
import PasswordListItem from './PasswordListItem.tsx';
import TagsMenu from './tag/TagsMenu.tsx';
import { useSearchStore } from '../../store/searchStore.ts';
import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import SearchBar from './SearchBar.tsx';

type PasswordListCardProps = {
	vaultId: string;
	revealedPasswords: Record<string, string>;
	loadingCiphertextPhase: Record<string, CiphertextPhase>;
	isSubmitting: boolean;
	onEdit: (password: PasswordMetadataDto) => void;
	onDelete: (passwordId: string) => void;
	onRevealToggle: (passwordId: string) => void;
};

function PasswordListCard({
	vaultId,
	revealedPasswords,
	loadingCiphertextPhase,
	isSubmitting,
	onEdit,
	onDelete,
	onRevealToggle,
}: PasswordListCardProps) {
	const { query, selectedTagsId } = useSearchStore();

	const [passwords, setPasswords] = useState<PasswordMetadataDto[]>([]);
	const [isLoadingPasswords, setIsLoadingPasswords] = useState(false);

	useEffect(() => {
		if (!vaultId) {
			setPasswords([]);
			return;
		}
		void loadPasswords(vaultId);
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
			keys: ['identifier', 'domain'],
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
		<section className="rounded-md bg-white p-5 shadow-md xl:w-1/2 w-full">
			<div
				className={
					'flex justify-between items-center w-full h-10 relative mb-4'
				}
			>
				<h2 className="text-xl font-semibold text-emerald-900">
					Passwords
				</h2>

				<TagsMenu />
			</div>

			<SearchBar />
			{(query || selectedTagsId.length > 0) && (
				<p className={'text-sm text-gray-500 mt-1'}>
					Showing {results.length} of {passwords.length} results.
				</p>
			)}

			<div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1 mt-5">
				{!isLoadingPasswords ? (
					results.length > 0 ? (
						results.map((result) => (
							<PasswordListItem
								key={result.item.passwordId}
								passwordDto={result.item}
								setPasswordDto={setPasswords}
								revealedPassword={
									revealedPasswords[result.item.passwordId]
								}
								phase={
									loadingCiphertextPhase[
										result.item.passwordId
									]
								}
								isSubmitting={isSubmitting}
								onEdit={onEdit}
								onDelete={onDelete}
								onRevealToggle={onRevealToggle}
							/>
						))
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
