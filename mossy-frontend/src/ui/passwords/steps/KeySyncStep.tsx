import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from 'react';
import RippleButton from '../../layout/RippleButton.tsx';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useDeviceSync } from '../../../hooks/useDeviceSync.ts';
import QRCodeStyling, { type Options } from 'qr-code-styling';
import SyncSuccessView from './SyncSuccessView.tsx';

type KeySyncModalProps = {
	vaultId: string;
	pin: string;
	setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
};

const qrConfig: Partial<Options> = {
	width: 240,
	height: 240,
	type: 'svg',
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

const stepVariants: Variants = {
	enter: { x: '100%', opacity: 0 },
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

export default function KeySyncStep({
	vaultId,
	pin,
	setIsKeySyncModalActive,
}: KeySyncModalProps) {
	const { isInitialized, syncCode, connect, disconnect } = useDeviceSync(
		undefined,
		vaultId
	);
	const qrCodeRef = useRef<HTMLDivElement>(null);
	const [synced, setSynced] = useState(false);

	useEffect(() => {
		if (!qrCodeRef.current || !isInitialized || !syncCode) return;

		const el = qrCodeRef.current;
		const url = `${window.location.origin}/key-sync?code=${syncCode}`;

		el.replaceChildren();

		const qr = new QRCodeStyling({
			...qrConfig,
			data: url,
		});

		qr.append(el);

		connect(`/api/v1/ws/key-sync?${syncCode}`, 'RECEIVER', pin).then(() => {
			setSynced(true);
			setTimeout(() => setIsKeySyncModalActive(false), 3500);
		});
	}, [syncCode, isInitialized]);

	return (
		<motion.div
			key="key-sync"
			variants={stepVariants}
			initial="enter"
			animate="center"
			exit="exit"
			className="bg-white shadow-md rounded-md lg:w-2/3 md:w-full h-3/4 flex flex-col justify-between items-center p-5 overflow-hidden"
		>
			<AnimatePresence mode="wait">
				{synced ? (
					<motion.div
						key="success"
						className="flex items-center justify-center w-full h-full"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<SyncSuccessView />
					</motion.div>
				) : (
					<motion.div
						key="qr"
						className="flex flex-col justify-between items-center w-full h-full"
						exit={{
							opacity: 0,
							scale: 0.95,
							transition: { duration: 0.2 },
						}}
					>
						<div>
							<h2 className="text-3xl font-semibold">
								To use this vault, please synchronize encryption
								key
							</h2>
							<p className="text-sm text-gray-500 mt-2">
								As encryption keys are stored on your device,
								only way to use them somewhere else is
								synchronization
							</p>
						</div>
						{isInitialized && (
							<div className="flex flex-col items-center gap-2">
								<div
									ref={qrCodeRef}
									className="w-56 h-56 flex justify-center items-center subpixel-antialiased"
									style={{
										transform: 'translateZ(0)',
										backfaceVisibility: 'hidden',
									}}
								/>
								<p className="text-center text-sm text-gray-600">
									Scan the QR code, or go to{' '}
									<span className="font-mono text-gray-800">
										{window.origin}/key-sync
									</span>{' '}
									on the device that has access to this vault
									and enter the code below.
								</p>
								<input
									type="text"
									value={syncCode || 'Failed to get code'}
									readOnly
									className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xl text-center text-gray-700"
								/>
							</div>
						)}
						<div className="flex gap-2 mt-5">
							<RippleButton
								onClick={() => {
									setIsKeySyncModalActive(false);
									disconnect();
								}}
								variant="outline"
							>
								Cancel
							</RippleButton>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
