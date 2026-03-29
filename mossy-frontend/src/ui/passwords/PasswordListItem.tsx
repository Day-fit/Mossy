import { type PasswordMetadataDto } from '../../api/password.api.ts';
import type { CiphertextPhase } from './index.ts';
import RippleButton from '../layout/RippleButton.tsx';

type PasswordListItemProps = {
	passwordDto: PasswordMetadataDto;
	revealedPassword?: string;
	phase?: CiphertextPhase;
	isSubmitting: boolean;
	onEdit: (password: PasswordMetadataDto) => void;
	onDelete: (passwordId: string) => void;
	onRevealToggle: (passwordId: string) => void;
};

function PasswordListItem({
	passwordDto,
	revealedPassword,
	phase,
	isSubmitting,
	onEdit,
	onDelete,
	onRevealToggle,
}: PasswordListItemProps) {
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
				</div>

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
			</div>

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
