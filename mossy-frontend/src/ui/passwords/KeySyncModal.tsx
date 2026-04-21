import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import RippleButton from '../layout/RippleButton.tsx';
import { motion } from 'framer-motion';
import { useDeviceSync } from '../../hooks/useDeviceSync.ts';
import QRCodeStyling, { type Options } from 'qr-code-styling';

type KeySyncModalProps = {
	setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
};

const qrConfig: Partial<Options> = {
	width: 240,
	height: 240,
	type: 'canvas',
	data: '',

	image: '/mossy_logo.png',
	margin: 12,

	qrOptions: {
		errorCorrectionLevel: 'H',
	},

	dotsOptions: {
		type: 'rounded',
		color: '#007735',
	},

	backgroundOptions: {
		color: '#ffffff',
	},

	imageOptions: {
		crossOrigin: 'anonymous',
		margin: 6,
		imageSize: 0.28,
	},

	cornersSquareOptions: {
		type: 'extra-rounded',
		color: '#007735',
	},

	cornersDotOptions: {
		type: 'dot',
		color: '#007735',
	},
};

export default function KeySyncModal({
	setIsKeySyncModalActive,
}: KeySyncModalProps) {
	const { isInitialized, syncCode } = useDeviceSync();
	const qrCodeRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!qrCodeRef.current || !isInitialized || !syncCode) return;

		const el = qrCodeRef.current;
		const url = `${window.location.origin}/keysync/${syncCode}`;

		el.replaceChildren();

		const qr = new QRCodeStyling({
			...qrConfig,
			data: url,
		});

		qr.append(el);
	}, [syncCode, isInitialized]);

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

				{isInitialized && (
					<div className={'flex flex-col items-center gap-2'}>
						<div
							ref={qrCodeRef}
							className="w-56 h-56 flex justify-center items-center subpixel-antialiased"
							style={{
								transform: 'translateZ(0)',
								backfaceVisibility: 'hidden',
							}}
						/>
						<p>Scan or type the code below</p>
						<input
							type="text"
							value={syncCode || 'Failed to get code'}
							readOnly
							className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xl text-center text-gray-700"
						/>
					</div>
				)}

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
