import { useMemo, useState } from 'react';
import {
	type PasswordMetadataDto,
	type TagDto,
} from '../../api/password.api.ts';
import type { CiphertextPhase } from './index.ts';
import RippleButton from '../layout/RippleButton.tsx';
import Tag from './tag/Tag.tsx';
import AssignTagDropdown from './tag/AssignTagDropdown.tsx';
import * as React from 'react';
import NoteCard from './note/NoteCard.tsx';
import {
	MdDownload,
	MdDelete,
	MdEdit,
	MdOutlineStickyNote2,
	MdPassword,
	MdStickyNote2,
	MdVpnKey,
} from 'react-icons/md';
import PasswordEntryInput from './PasswordEntryInput.tsx';
import type { PasswordFormState, SavePasswordResult } from './index.ts';

type PasswordListItemProps = {
	passwordDto: PasswordMetadataDto;
	setPasswordDto: React.Dispatch<React.SetStateAction<PasswordMetadataDto[]>>;
	revealedPassword?: string;
	phase?: CiphertextPhase;
	isSubmitting: boolean;
	isVaultOnline: boolean;
	onSave: (
		formState: PasswordFormState,
		passwordId?: string
	) => Promise<SavePasswordResult>;
	onDelete: (passwordId: string) => void;
	onRevealToggle: (passwordId: string) => void;
	onDownloadSshKey: (password: PasswordMetadataDto) => void;
};

function PasswordListItem({
	passwordDto,
	setPasswordDto,
	revealedPassword,
	phase,
	isSubmitting,
	isVaultOnline,
	onSave,
	onDelete,
	onRevealToggle,
	onDownloadSshKey,
}: PasswordListItemProps) {
	const assignedTags = useMemo(() => passwordDto.tags, [passwordDto.tags]);
	const [isNoteShown, setIsNoteShown] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const setAssignedTags: React.Dispatch<React.SetStateAction<TagDto[]>> = (
		value
	) => {
		setPasswordDto((prev) =>
			prev.map((password) => {
				if (password.passwordId !== passwordDto.passwordId) {
					return password;
				}

				const tags =
					typeof value === 'function' ? value(password.tags) : value;

				return {
					...password,
					tags,
				};
			})
		);
	};

	if (isEditing) {
		const initialState: PasswordFormState =
			passwordDto.passwordType === 'SSH_KEY'
				? {
						identifier: passwordDto.identifier,
						address: passwordDto.address,
						privateKey: '',
						publicKey: '',
						passwordType: 'SSH_KEY',
					}
				: {
						identifier: passwordDto.identifier,
						address: passwordDto.address,
						password: '',
						passwordType: 'PASSWORD',
					};

		return (
			<PasswordEntryInput
				initialState={initialState}
				isEditing
				isSubmitting={isSubmitting}
				isVaultOnline={isVaultOnline}
				onSubmit={(formState) =>
					onSave(formState, passwordDto.passwordId)
				}
				onCancel={() => setIsEditing(false)}
			/>
		);
	}

	return (
		<article className="flex flex-col gap-3 rounded-md border border-gray-200 p-3">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<span
							className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-gray-100 text-gray-700"
							title={
								passwordDto.passwordType === 'SSH_KEY'
									? 'SSH key'
									: 'Password'
							}
							aria-label={
								passwordDto.passwordType === 'SSH_KEY'
									? 'SSH key'
									: 'Password'
							}
						>
							{passwordDto.passwordType === 'SSH_KEY' ? (
								<MdVpnKey size={14} />
							) : (
								<MdPassword size={14} />
							)}
						</span>

						<p className="font-medium text-gray-900">
							{passwordDto.identifier}
						</p>
					</div>

					<p className="text-sm text-gray-600">
						{passwordDto.address}
					</p>

					<p className="text-xs text-gray-500">
						Updated{' '}
						{new Date(passwordDto.lastModified).toLocaleString()}
					</p>

					<div className="flex flex-wrap gap-1 mt-2">
						{assignedTags.length > 0 ? (
							assignedTags.map((tag) => (
								<Tag
									key={tag.tagId}
									tagId={tag.tagId}
									name={tag.tagName}
									color={tag.color}
								/>
							))
						) : (
							<Tag name="unlabeled" color="#373737" />
						)}

						<AssignTagDropdown
							assignedTags={assignedTags}
							setAssignedTags={setAssignedTags}
							passwordId={passwordDto.passwordId}
						/>
					</div>
				</div>

				<div className={'flex flex-col items-end gap-2'}>
					<div className="flex gap-2">
						<button
							type="button"
							className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
							disabled={isSubmitting}
							onClick={() => setIsEditing(true)}
							aria-label="Edit password"
							title="Edit password"
						>
							<MdEdit size={18} />
						</button>

						<button
							type="button"
							className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
							disabled={isSubmitting}
							onClick={() => onDelete(passwordDto.passwordId)}
							aria-label="Delete password"
							title="Delete password"
						>
							<MdDelete size={18} />
						</button>
					</div>

					{passwordDto.hasNote ? (
						<MdStickyNote2
							size={32}
							className={`cursor-pointer`}
							onClick={() => setIsNoteShown(!isNoteShown)}
						/>
					) : (
						<MdOutlineStickyNote2
							size={32}
							className={`cursor-pointer`}
							onClick={() => setIsNoteShown(!isNoteShown)}
						/>
					)}
				</div>
			</div>

			<NoteCard
				isOpen={isNoteShown}
				setIsOpen={setIsNoteShown}
				passwordId={passwordDto.passwordId}
			/>

			<div className="flex items-center justify-between gap-3 rounded bg-gray-50 p-2">
				<p className="max-w-full overflow-x-auto whitespace-nowrap font-mono text-sm text-gray-700">
					{passwordDto.passwordType === 'SSH_KEY'
						? 'SSH key file'
						: (revealedPassword ?? '••••••••••••')}
				</p>

				{passwordDto.passwordType === 'SSH_KEY' ? (
					<RippleButton
						type="button"
						variant="outline"
						className="inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-sm"
						disabled={phase !== undefined}
						rippleColor="rgb(0, 0, 0, 0.7)"
						onClick={() => onDownloadSshKey(passwordDto)}
					>
						<MdDownload size={16} />
						{phase !== undefined ? `${phase}...` : 'Download keys'}
					</RippleButton>
				) : (
					<RippleButton
						type="button"
						variant="outline"
						className="rounded-sm border px-2 py-1 text-sm"
						disabled={phase !== undefined}
						rippleColor="rgb(0, 0, 0, 0.7)"
						onClick={() => onRevealToggle(passwordDto.passwordId)}
					>
						{phase !== undefined
							? `${phase}...`
							: revealedPassword
								? 'Hide'
								: 'Reveal'}
					</RippleButton>
				)}
			</div>
		</article>
	);
}

export default PasswordListItem;
