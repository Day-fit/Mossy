import { useMemo, useState } from 'react';
import * as React from 'react';
import {
	type PasswordMetadataDto,
	type TagDto,
} from '../../api/password.api.ts';
import type { PasswordFormState, SavePasswordResult } from './index.ts';
import PasswordEntryInput from './PasswordEntryInput.tsx';
import Tag from './tag/Tag.tsx';
import AssignTagDropdown from './tag/AssignTagDropdown.tsx';
import NoteCard from './note/NoteCard.tsx';
import {
	MdDelete,
	MdEdit,
	MdOutlineStickyNote2,
	MdStickyNote2,
} from 'react-icons/md';

export type PasswordListItemFrameProps = {
	passwordDto: PasswordMetadataDto;
	setPasswordDto: React.Dispatch<React.SetStateAction<PasswordMetadataDto[]>>;
	isSubmitting: boolean;
	isVaultOnline: boolean;
	onSave: (
		formState: PasswordFormState,
		passwordId?: string
	) => Promise<SavePasswordResult>;
	onDelete: (passwordId: string) => void;
	icon: React.ReactNode;
	iconLabel: string;
	editInitialState: PasswordFormState;
	children: React.ReactNode;
};

export default function PasswordListItemFrame({
	passwordDto,
	setPasswordDto,
	isSubmitting,
	isVaultOnline,
	onSave,
	onDelete,
	icon,
	iconLabel,
	editInitialState,
	children,
}: PasswordListItemFrameProps) {
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
		return (
			<PasswordEntryInput
				initialState={editInitialState}
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
							title={iconLabel}
							aria-label={iconLabel}
						>
							{icon}
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

				<div className="flex flex-col items-end gap-2">
					<div className="flex gap-2">
						<button
							type="button"
							className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-gray-700 hover:bg-gray-50 disabled:opacity-60"
							disabled={isSubmitting}
							onClick={() => setIsEditing(true)}
							aria-label={`Edit ${iconLabel.toLowerCase()}`}
							title={`Edit ${iconLabel.toLowerCase()}`}
						>
							<MdEdit size={18} />
						</button>

						<button
							type="button"
							className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
							disabled={isSubmitting}
							onClick={() => onDelete(passwordDto.passwordId)}
							aria-label={`Delete ${iconLabel.toLowerCase()}`}
							title={`Delete ${iconLabel.toLowerCase()}`}
						>
							<MdDelete size={18} />
						</button>
					</div>

					{passwordDto.hasNote ? (
						<MdStickyNote2
							size={32}
							className="cursor-pointer"
							onClick={() => setIsNoteShown(!isNoteShown)}
						/>
					) : (
						<MdOutlineStickyNote2
							size={32}
							className="cursor-pointer"
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

			{children}
		</article>
	);
}
