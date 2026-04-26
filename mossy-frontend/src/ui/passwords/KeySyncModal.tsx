import { type Dispatch, type SetStateAction, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import PasswordPinStep from './steps/PasswordPinStep.tsx';
import KeySyncStep from './steps/KeySyncStep.tsx';

type KeySyncModalProps = {
	setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
	vaultId: string;
};

const stepVariants: Variants = {
	enter: {
		x: '100%',
		opacity: 0,
	},
	center: {
		x: 0,
		opacity: 1,
		transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
	},
	exit: {
		x: '-100%',
		opacity: 0,
		transition: { duration: 0.28, ease: [0.55, 0, 0.78, 0] },
	},
};

export default function KeySyncModal({
	setIsKeySyncModalActive,
	vaultId,
}: KeySyncModalProps) {
	const [pin, setPin] = useState<string | null>(null);

	return (
		<div
			className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/30 p-4 overflow-hidden"
			onClick={(e) => {
				if (e.target === e.currentTarget)
					setIsKeySyncModalActive(false);
			}}
		>
			<AnimatePresence mode="wait">
				{!pin ? (
					<motion.div
						key="password-pin"
						className="w-full h-full flex items-center justify-center"
						variants={stepVariants}
						initial="enter"
						animate="center"
						exit="exit"
					>
						<PasswordPinStep
							vaultId={vaultId}
							onNext={setPin}
							onCancel={() => setIsKeySyncModalActive(false)}
						/>
					</motion.div>
				) : (
					<motion.div
						key="key-sync"
						variants={stepVariants}
						initial="enter"
						animate="center"
						exit="exit"
					>
						<KeySyncStep
							vaultId={vaultId}
							pin={pin}
							setIsKeySyncModalActive={setIsKeySyncModalActive}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
