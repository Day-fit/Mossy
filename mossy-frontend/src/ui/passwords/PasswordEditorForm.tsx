import { motion } from 'framer-motion';
import type { FormEvent } from 'react';
import StrengthMetter from './StrengthMetter.tsx';
import RippleButton from '../layout/RippleButton.tsx';
import PasswordMessages from './PasswordMessages.tsx';

type PasswordEditorFormProps = {
	identifier: string;
	domain: string;
	password: string;
	isEditing: boolean;
	isSubmitting: boolean;
	isLoadingVaults: boolean;
	isVaultOnline: boolean;
	successMessage: string | null;
	errorMessage: string | null;
	onIdentifierChange: (value: string) => void;
	onDomainChange: (value: string) => void;
	onPasswordChange: (value: string) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onCancelEdit: () => void;
};

export default function PasswordEditorForm({
	identifier,
	domain,
	password,
	isEditing,
	isSubmitting,
	isLoadingVaults,
	isVaultOnline,
	successMessage,
	errorMessage,
	onIdentifierChange,
	onDomainChange,
	onPasswordChange,
	onSubmit,
	onCancelEdit,
}: PasswordEditorFormProps) {
	return (
		<motion.form
			onSubmit={onSubmit}
			className="flex flex-col gap-4 rounded-md bg-white p-4 shadow-md sm:p-5"
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: 'easeOut' }}
		>
			<h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
				{isEditing ? 'Update password' : 'Add password'}
			</h2>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<input
					type="text"
					name="identifier"
					value={identifier}
					onChange={(event) => onIdentifierChange(event.target.value)}
					placeholder="Enter identifier (email/username)"
					className="border-b-2 p-2"
					required
				/>

				<input
					type="text"
					name="domain"
					value={domain}
					onChange={(event) => onDomainChange(event.target.value)}
					placeholder="Enter domain"
					className="border-b-2 p-2"
					required
				/>

				<div className="flex flex-col gap-2 lg:col-span-2">
					<input
						type="password"
						name="password"
						value={password}
						onChange={(event) =>
							onPasswordChange(event.target.value)
						}
						placeholder={
							isEditing ? 'Enter new password' : 'Enter password'
						}
						className="border-b-2 p-2"
						required
					/>
					<StrengthMetter password={password} />
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 sm:gap-3">
				<RippleButton
					type="submit"
					variant="outline"
					className="rounded-sm border-2 px-4 py-2"
					disabled={isSubmitting || isLoadingVaults || !isVaultOnline}
				>
					{isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add'}
				</RippleButton>

				{isEditing ? (
					<RippleButton
						type="button"
						variant="outline"
						className="rounded-sm border-2 px-4 py-2"
						onClick={onCancelEdit}
					>
						Cancel edit
					</RippleButton>
				) : null}

				<PasswordMessages
					successMessage={successMessage}
					errorMessage={errorMessage}
					className="flex min-w-0 flex-col gap-1"
				/>
			</div>
		</motion.form>
	);
}
