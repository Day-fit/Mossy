import type { PasswordMetadataDto } from '../../api/password.api.ts';
import type { CiphertextPhase } from './index.ts';
import PasswordListItem from './PasswordListItem.tsx';

type PasswordListCardProps = {
	passwords: PasswordMetadataDto[];
	revealedPasswords: Record<string, string>;
	loadingCiphertextPhase: Record<string, CiphertextPhase>;
	isLoadingPasswords: boolean;
	isSubmitting: boolean;
	onEdit: (password: PasswordMetadataDto) => void;
	onDelete: (passwordId: string) => void;
	onRevealToggle: (passwordId: string) => void;
};

function PasswordListCard({
	passwords,
	revealedPasswords,
	loadingCiphertextPhase,
	isLoadingPasswords,
	isSubmitting,
	onEdit,
	onDelete,
	onRevealToggle,
}: PasswordListCardProps) {
	return (
		<section className="rounded-md bg-white p-5 shadow-md">
			<h2 className="mb-4 text-xl font-semibold text-gray-800">
				Passwords
			</h2>
			{isLoadingPasswords ? (
				<p className="text-sm text-gray-500">Loading passwords...</p>
			) : null}
			{!isLoadingPasswords && passwords.length === 0 ? (
				<p className="text-sm text-gray-500">
					No passwords for selected vault.
				</p>
			) : null}

			<div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
				{passwords.map((passwordDto) => (
					<PasswordListItem
						key={passwordDto.passwordId}
						passwordDto={passwordDto}
						revealedPassword={
							revealedPasswords[passwordDto.passwordId]
						}
						phase={loadingCiphertextPhase[passwordDto.passwordId]}
						isSubmitting={isSubmitting}
						onEdit={onEdit}
						onDelete={onDelete}
						onRevealToggle={onRevealToggle}
					/>
				))}
			</div>
		</section>
	);
}

export default PasswordListCard;
