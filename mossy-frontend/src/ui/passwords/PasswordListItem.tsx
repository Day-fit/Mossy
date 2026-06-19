import * as React from 'react';
import { MdPassword } from 'react-icons/md';
import type { PasswordMetadataDto } from '../../api/password.api.ts';
import type {
	CiphertextPhase,
	PasswordFormState,
	SavePasswordResult,
} from './index.ts';
import RippleButton from '../layout/RippleButton.tsx';
import PasswordListItemFrame from './PasswordListItemFrame.tsx';

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
}: PasswordListItemProps) {
	return (
		<PasswordListItemFrame
			passwordDto={passwordDto}
			setPasswordDto={setPasswordDto}
			isSubmitting={isSubmitting}
			isVaultOnline={isVaultOnline}
			onSave={onSave}
			onDelete={onDelete}
			icon={<MdPassword size={14} />}
			iconLabel="Password"
			editInitialState={{
				identifier: passwordDto.identifier,
				address: passwordDto.address,
				password: '',
				passwordType: 'PASSWORD',
			}}
		>
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
		</PasswordListItemFrame>
	);
}

export default PasswordListItem;
