import StrengthMeter from './StrengthMeter.tsx';
import type { PasswordFormState, StatusMessage } from './index.ts';
import RippleButton from '../layout/RippleButton.tsx';

type PasswordFormCardProps = {
	formState: PasswordFormState;
	isEditing: boolean;
	isSubmitting: boolean;
	isVaultOnline: boolean;
	status: StatusMessage;
	onSubmit: () => void;
	onChange: (field: keyof PasswordFormState, value: string) => void;
	onCancelEdit: () => void;
};

function PasswordFormCard({
	formState,
	isEditing,
	isSubmitting,
	isVaultOnline,
	status,
	onSubmit,
	onChange,
	onCancelEdit,
}: PasswordFormCardProps) {
	function normalizeDomain(input: string) {
		try {
			const url = new URL(
				input.startsWith('http') ? input : `https://${input}`
			);
			return url.hostname.replace(/^www\./, '');
		} catch {
			return input
				.replace(/^https?:\/\//, '')
				.replace(/^www\./, '')
				.split('/')[0]
				.split('?')[0]
				.split('#')[0];
		}
	}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				onChange('domain', normalizeDomain(formState.domain));
				onSubmit();
			}}
			className="flex flex-col gap-4 rounded-md bg-white p-5 shadow-md"
		>
			<h2 className="text-xl font-semibold text-emerald-900">
				{isEditing ? 'Update password' : 'Add password'}
			</h2>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<input
					type="text"
					name="identifier"
					value={formState.identifier}
					onChange={(event) =>
						onChange('identifier', event.target.value)
					}
					placeholder="Enter identifier (email/username)"
					className="border-b-2 p-2"
					required
				/>

				<input
					type="text"
					name="domain"
					value={formState.domain}
					onChange={(event) => onChange('domain', event.target.value)}
					placeholder="Enter domain"
					className="border-b-2 p-2"
					required
				/>

				<div className="flex flex-col gap-2 lg:col-span-2">
					<input
						type="password"
						name="password"
						value={formState.password}
						onChange={(event) =>
							onChange('password', event.target.value)
						}
						placeholder={
							isEditing ? 'Enter new password' : 'Enter password'
						}
						className="border-b-2 p-2"
						required
					/>
					<StrengthMeter password={formState.password} />
				</div>
			</div>

			<div className="flex items-center gap-3">
				<RippleButton
					type="submit"
					disabled={isSubmitting || !isVaultOnline}
				>
					{isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add'}
				</RippleButton>

				{isEditing ? (
					<RippleButton
						type="button"
						variant="outline"
						onClick={onCancelEdit}
					>
						Cancel edit
					</RippleButton>
				) : null}

				{status?.type === 'success' ? (
					<p className="text-sm text-emerald-700">{status.message}</p>
				) : null}

				{status?.type === 'error' ? (
					<p className="text-sm text-red-600">{status.message}</p>
				) : null}
			</div>
		</form>
	);
}

export default PasswordFormCard;
