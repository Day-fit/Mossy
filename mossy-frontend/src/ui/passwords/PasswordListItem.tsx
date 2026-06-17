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
import { MdOutlineStickyNote2, MdStickyNote2 } from 'react-icons/md';

type PasswordListItemProps = {
	passwordDto: PasswordMetadataDto;
	setPasswordDto: React.Dispatch<React.SetStateAction<PasswordMetadataDto[]>>;
	revealedPassword?: string;
	phase?: CiphertextPhase;
	isSubmitting: boolean;
	onEdit: (password: PasswordMetadataDto) => void;
	onDelete: (passwordId: string) => void;
	onRevealToggle: (passwordId: string) => void;
};

function PasswordListItem({
	passwordDto,
	setPasswordDto,
	revealedPassword,
	phase,
	isSubmitting,
	onEdit,
	onDelete,
	onRevealToggle,
}: PasswordListItemProps) {
	const assignedTags = useMemo(() => passwordDto.tags, [passwordDto.tags]);
	const [isNoteShown, setIsNoteShown] = useState(false);

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

	return (
		<article className="flex flex-col gap-3 rounded-md border border-gray-200 p-3">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-medium text-gray-900">
						{passwordDto.identifier}
					</p>

					<p className="text-sm text-gray-600">
						{passwordDto.domain}
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
							className="rounded-sm border px-2 py-1 text-sm"
							disabled={isSubmitting}
							onClick={() => onEdit(passwordDto)}
						>
							Edit
						</button>

						<button
							type="button"
							className="rounded-sm border border-red-300 px-2 py-1 text-sm text-red-600"
							disabled={isSubmitting}
							onClick={() => onDelete(passwordDto.passwordId)}
						>
							Delete
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
					{revealedPassword ?? '••••••••••••'}
				</p>

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
			</div>
		</article>
	);
}

export default PasswordListItem;
