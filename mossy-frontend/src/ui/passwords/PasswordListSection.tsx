import { motion } from 'framer-motion';
import type { PasswordMetadataDto } from '../../api/password.api.ts';
import RippleButton from '../layout/RippleButton.tsx';

type PasswordListSectionProps = {
	passwords: PasswordMetadataDto[];
	revealedPasswords: Record<string, string>;
	isLoadingPasswords: boolean;
	isSubmitting: boolean;
	loadingCiphertextPhase: Record<string, 'Fetching' | 'Decrypting'>;
	onEdit: (passwordDto: PasswordMetadataDto) => void;
	onDelete: (passwordId: string) => Promise<void>;
	onRevealToggle: (passwordId: string) => Promise<void>;
};

export default function PasswordListSection({
	passwords,
	revealedPasswords,
	isLoadingPasswords,
	isSubmitting,
	loadingCiphertextPhase,
	onEdit,
	onDelete,
	onRevealToggle,
}: PasswordListSectionProps) {
	return (
		<motion.section
			className="rounded-md bg-white p-4 shadow-md sm:p-5"
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
		>
			<h2 className="mb-4 text-lg font-semibold text-gray-800 sm:text-xl">
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
					<article
						key={passwordDto.passwordId}
						className="flex flex-col gap-3 rounded-md border border-gray-200 p-3"
					>
						<div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
							<div>
								<p className="font-medium text-gray-900">
									{passwordDto.identifier}
								</p>
								<p className="text-sm text-gray-600">
									{passwordDto.domain}
								</p>
								<p className="text-xs text-gray-500">
									Updated{' '}
									{new Date(
										passwordDto.lastModified
									).toLocaleString()}
								</p>
							</div>

							<div className="flex w-full gap-2 sm:w-auto">
								<RippleButton
									type="button"
									variant="outline"
									className="rounded-sm border px-2 py-1 text-sm"
									disabled={isSubmitting}
									onClick={() => onEdit(passwordDto)}
								>
									Edit
								</RippleButton>

								<RippleButton
									type="button"
									variant="outline"
									className="rounded-sm border border-red-300 px-2 py-1 text-sm text-red-600"
									disabled={isSubmitting}
									onClick={() =>
										void onDelete(passwordDto.passwordId)
									}
								>
									Delete
								</RippleButton>
							</div>
						</div>

						<div className="flex flex-col items-start justify-between gap-3 rounded bg-gray-50 p-2 sm:flex-row sm:items-center">
							<p className="max-w-full overflow-x-auto whitespace-nowrap font-mono text-sm text-gray-700">
								{revealedPasswords[passwordDto.passwordId] ??
									'••••••••••••'}
							</p>

							<RippleButton
								type="button"
								variant="outline"
								className="rounded-sm border px-2 py-1 text-sm"
								disabled={
									loadingCiphertextPhase[
										passwordDto.passwordId
									] !== undefined
								}
								rippleColor="rgb(0, 0, 0, 0.7)"
								onClick={() =>
									void onRevealToggle(passwordDto.passwordId)
								}
							>
								{loadingCiphertextPhase[
									passwordDto.passwordId
								] !== undefined
									? `${loadingCiphertextPhase[passwordDto.passwordId]}...`
									: revealedPasswords[passwordDto.passwordId]
										? 'Hide'
										: 'Reveal'}
							</RippleButton>
						</div>
					</article>
				))}
			</div>
		</motion.section>
	);
}
