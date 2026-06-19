import * as React from 'react';
import { MdDownload, MdVpnKey } from 'react-icons/md';
import type { PasswordMetadataDto } from '../../api/password.api.ts';
import type {
	CiphertextPhase,
	PasswordFormState,
	SavePasswordResult,
} from './index.ts';
import RippleButton from '../layout/RippleButton.tsx';
import PasswordListItemFrame from './PasswordListItemFrame.tsx';

type SshKeyListItemProps = {
	passwordDto: PasswordMetadataDto;
	setPasswordDto: React.Dispatch<React.SetStateAction<PasswordMetadataDto[]>>;
	phase?: CiphertextPhase;
	isSubmitting: boolean;
	isVaultOnline: boolean;
	onSave: (
		formState: PasswordFormState,
		passwordId?: string
	) => Promise<SavePasswordResult>;
	onDelete: (passwordId: string) => void;
	onDownloadSshKey: (password: PasswordMetadataDto) => void;
};

function SshKeyListItem({
	passwordDto,
	setPasswordDto,
	phase,
	isSubmitting,
	isVaultOnline,
	onSave,
	onDelete,
	onDownloadSshKey,
}: SshKeyListItemProps) {
	return (
		<PasswordListItemFrame
			passwordDto={passwordDto}
			setPasswordDto={setPasswordDto}
			isSubmitting={isSubmitting}
			isVaultOnline={isVaultOnline}
			onSave={onSave}
			onDelete={onDelete}
			icon={<MdVpnKey size={14} />}
			iconLabel="SSH key"
			editInitialState={{
				identifier: passwordDto.identifier,
				address: passwordDto.address,
				privateKey: '',
				publicKey: '',
				passwordType: 'SSH_KEY',
			}}
		>
			<div className="flex items-center justify-between gap-3 rounded bg-gray-50 p-2">
				<p className="max-w-full overflow-x-auto whitespace-nowrap font-mono text-sm text-gray-700">
					SSH key file
				</p>

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
			</div>
		</PasswordListItemFrame>
	);
}

export default SshKeyListItem;
