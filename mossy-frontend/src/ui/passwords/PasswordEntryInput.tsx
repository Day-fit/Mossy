import { useState } from 'react';
import { MdCheck, MdClose, MdPassword, MdVpnKey } from 'react-icons/md';
import type { PasswordFormState, SavePasswordResult } from './index.ts';
import StrengthMeter from './StrengthMeter.tsx';
import RippleButton from '../layout/RippleButton.tsx';
import type { PasswordType } from '../../api/password.api.ts';
import SshKeyEntryInput from './SshKeyEntryInput.tsx';
import { validateSshKeyPair } from './secretPayload.ts';

type PasswordEntryInputProps = {
	initialState?: PasswordFormState;
	isEditing?: boolean;
	isSubmitting: boolean;
	isVaultOnline: boolean;
	onSubmit: (state: PasswordFormState) => Promise<SavePasswordResult>;
	onCancel: () => void;
};

const EMPTY_FORM_STATE: PasswordFormState = {
	identifier: '',
	address: '',
	password: '',
	passwordType: 'PASSWORD',
};

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

export default function PasswordEntryInput({
	initialState = EMPTY_FORM_STATE,
	isEditing = false,
	isSubmitting,
	isVaultOnline,
	onSubmit,
	onCancel,
}: PasswordEntryInputProps) {
	const [formState, setFormState] = useState<PasswordFormState>(() => ({
		...initialState,
	}));
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isSubmitPending, setIsSubmitPending] = useState(false);
	const isBusy = isSubmitting || isSubmitPending;

	const handleBaseChange = (
		field: 'identifier' | 'address',
		value: string
	) => {
		setFormState((prev) => ({ ...prev, [field]: value }));
	};

	const handlePasswordTypeChange = (passwordType: PasswordType) => {
		setSubmitError(null);
		setFormState((prev) =>
			passwordType === 'SSH_KEY'
				? {
						identifier: prev.identifier,
						address: prev.address,
						privateKey: '',
						publicKey: '',
						passwordType,
					}
				: {
						identifier: prev.identifier,
						address: prev.address,
						password: '',
						passwordType,
					}
		);
	};

	const handlePasswordChange = (password: string) => {
		setFormState((prev) =>
			prev.passwordType === 'PASSWORD'
				? {
						...prev,
						password,
					}
				: prev
		);
	};

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();

				void (async () => {
					if (isBusy) return;

					if (formState.passwordType === 'SSH_KEY') {
						const validationMessage = validateSshKeyPair(
							formState.privateKey,
							formState.publicKey
						);

						if (validationMessage) {
							setSubmitError(validationMessage);
							return;
						}
					}

					setSubmitError(null);
					setIsSubmitPending(true);
					let shouldClose = false;

					try {
						const result = await onSubmit({
							...formState,
							address: normalizeDomain(formState.address),
						});

						shouldClose = result === 'saved';
					} finally {
						if (!shouldClose) {
							setIsSubmitPending(false);
						}
					}

					if (shouldClose) {
						onCancel();
					}
				})();
			}}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					event.preventDefault();
					onCancel();
				}
			}}
			className={`flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-3 shadow-[0_0_0_3px_rgba(0,0,0,0.04)] ${
				isSubmitPending ? 'animate-pulse' : ''
			}`}
		>
			<div className="flex flex-wrap items-center gap-2">
				{isEditing ? (
					<span className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-2 py-1 text-sm text-gray-700">
						{formState.passwordType === 'SSH_KEY' ? (
							<MdVpnKey size={16} />
						) : (
							<MdPassword size={16} />
						)}
						{formState.passwordType === 'SSH_KEY'
							? 'SSH key'
							: 'Password'}
					</span>
				) : (
					<>
						<button
							type="button"
							onClick={() => handlePasswordTypeChange('PASSWORD')}
							className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-sm ${
								formState.passwordType === 'PASSWORD'
									? 'border-emerald-700 bg-emerald-50 text-emerald-900'
									: 'border-gray-200 text-gray-700 hover:bg-gray-50'
							}`}
							aria-pressed={formState.passwordType === 'PASSWORD'}
						>
							<MdPassword size={16} />
							Password
						</button>

						<button
							type="button"
							onClick={() => handlePasswordTypeChange('SSH_KEY')}
							className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-sm ${
								formState.passwordType === 'SSH_KEY'
									? 'border-emerald-700 bg-emerald-50 text-emerald-900'
									: 'border-gray-200 text-gray-700 hover:bg-gray-50'
							}`}
							aria-pressed={formState.passwordType === 'SSH_KEY'}
						>
							<MdVpnKey size={16} />
							SSH key
						</button>
					</>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<input
					type="text"
					name="identifier"
					value={formState.identifier}
					onChange={(event) =>
						handleBaseChange('identifier', event.target.value)
					}
					placeholder="Enter identifier (email/username)"
					className="border-b-2 p-2"
					required
					autoFocus
				/>

				<input
					type="text"
					name="address"
					value={formState.address}
					onChange={(event) =>
						handleBaseChange('address', event.target.value)
					}
					placeholder="Enter address"
					className="border-b-2 p-2"
					required
				/>
			</div>

			{formState.passwordType === 'SSH_KEY' ? (
				<SshKeyEntryInput
					formState={formState}
					setFormState={setFormState}
					setSubmitError={setSubmitError}
				/>
			) : (
				<div className="flex flex-col gap-2">
					<input
						type="password"
						name="password"
						value={formState.password}
						onChange={(event) =>
							handlePasswordChange(event.target.value)
						}
						placeholder={
							isEditing ? 'Enter new password' : 'Enter password'
						}
						className="border-b-2 p-2"
						required
					/>
					<StrengthMeter password={formState.password} />
				</div>
			)}

			{submitError ? (
				<p className="text-sm text-red-600">{submitError}</p>
			) : null}

			<div className="flex items-center gap-2">
				<RippleButton
					type="submit"
					disabled={isBusy || !isVaultOnline}
					className="inline-flex items-center gap-1"
				>
					<MdCheck size={16} />
					{isBusy ? 'Saving...' : isEditing ? 'Update' : 'Add'}
				</RippleButton>

				<RippleButton
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={isBusy}
					className="inline-flex items-center gap-1"
				>
					<MdClose size={16} />
					Cancel
				</RippleButton>
			</div>
		</form>
	);
}
