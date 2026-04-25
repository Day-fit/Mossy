import { type Dispatch, type SetStateAction, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import PasswordPinStep from './steps/PasswordPinStep.tsx';
import KeySyncStep from './steps/KeySyncStep.tsx';

type KeySyncModalProps = {
	setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
	vaultId: string;
};

export default function KeySyncModal({
	setIsKeySyncModalActive,
	vaultId,
}: KeySyncModalProps) {
	const [pin, setPin] = useState<string | null>(null);

	return (
		<div
			className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget)
					setIsKeySyncModalActive(false);
			}}
		>
			<AnimatePresence>
				{!pin ? (
					<PasswordPinStep
						vaultId={vaultId}
						onNext={setPin}
						onCancel={() => setIsKeySyncModalActive(false)}
					/>
				) : (
					<KeySyncStep
						vaultId={vaultId}
						pin={pin}
						setIsKeySyncModalActive={setIsKeySyncModalActive}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
