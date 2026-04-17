import type { Dispatch, SetStateAction } from 'react';
import RippleButton from '../layout/RippleButton.tsx';
import { motion } from 'framer-motion';

type KeySyncModalProps = {
	setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
};

export default function KeySyncModal({
	setIsKeySyncModalActive,
}: KeySyncModalProps) {
	return (
		<div
			className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget)
					setIsKeySyncModalActive(false);
			}}
		>
			<motion.div
				initial={{ opacity: 0, y: 50 }}
				animate={{ opacity: 1, y: 0 }}
				className="bg-white shadow-md rounded-md lg:w-2/3 md:w-full h-3/4 flex flex-col justify-between items-center p-5"
			>
				<div>
					<h2 className={'text-3xl font-semibold'}>
						To use this vault, please synchronize encryption key
					</h2>
					<p className={'text-sm text-gray-500 mt-2'}>
						As encryption keys are stored on your device, only way
						to use them somewhere else is synchronization
					</p>
				</div>

				<div className={'flex flex-col items-center gap-2'}>
					<img
						src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=placeholder"
						alt={'Code QR to process synchronization'}
						className="w-56 h-56"
					/>
					<p>Scan or type the code below</p>
					<input
						type="text"
						value={'000-000'}
						readOnly
						className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xl text-center text-gray-700"
					/>
				</div>

				<div className={'flex gap-2 mt-5'}>
					<RippleButton variant={'primary'}>Continue</RippleButton>

					<RippleButton
						onClick={() => setIsKeySyncModalActive(false)}
						variant={'outline'}
					>
						Cancel
					</RippleButton>
				</div>
			</motion.div>
		</div>
	);
}
