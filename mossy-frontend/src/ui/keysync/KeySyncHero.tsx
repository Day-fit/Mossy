import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { OTPInput } from 'input-otp';
import { useDeviceSync } from '../../hooks/useDeviceSync.ts';
import { useDeviceStore } from '../../store/deviceStore.ts';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import { PinNotFoundException } from '../../exception/PinNotFoundException.ts';
import RippleButton from '../layout/RippleButton.tsx';

const containerVariants: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07 } },
};

const childVariants: Variants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] } },
};

function SuccessIcon() {
	return (
		<svg width="88" height="88" viewBox="0 0 80 80">
			<circle
				cx="40"
				cy="40"
				r="35"
				fill="none"
				stroke="#e6f4ee"
				strokeWidth="6"
			/>
			<motion.circle
				cx="40"
				cy="40"
				r="35"
				fill="none"
				stroke="#007735"
				strokeWidth="6"
				strokeLinecap="round"
				transform="rotate(-90 40 40)"
				initial={{ pathLength: 0 }}
				animate={{ pathLength: 1 }}
				transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
			/>
			<motion.polyline
				points="24,41 35,52 56,30"
				fill="none"
				stroke="#007735"
				strokeWidth="5.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				initial={{ pathLength: 0 }}
				animate={{ pathLength: 1 }}
				transition={{ duration: 0.35, delay: 0.55, ease: 'easeOut' }}
			/>
		</svg>
	);
}

function KeyIcon() {
	return (
		<svg
			width="36"
			height="36"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#007735"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
		</svg>
	);
}

function SlotBox({
	slot,
	index,
	finished,
	fromUrl,
}: {
	slot: { char: string | null; isActive: boolean };
	index: number;
	finished: boolean;
	fromUrl: boolean;
}) {
	return (
		<motion.div
			variants={childVariants}
			animate={
				finished
					? {
							borderColor: ['#e5e7eb', '#007735', '#007735'],
							boxShadow: [
								'0 0 0 0px #00773500',
								'0 0 0 4px #00773530',
								'0 0 0 0px #00773500',
							],
						}
					: {}
			}
			transition={
				finished
					? {
							duration: 0.5,
							delay: (5 - index) * 0.08,
							ease: 'easeOut',
						}
					: {}
			}
			className={`
				w-16 h-16 border-2 rounded-lg flex items-center justify-center text-2xl font-semibold
				transition-colors duration-150
				${
					finished
						? 'border-gray-200 bg-white text-gray-800'
						: fromUrl
							? 'border-gray-200 bg-gray-50 text-gray-400'
							: slot.isActive
								? 'border-[#007735] bg-green-50 shadow-sm shadow-green-100'
								: 'border-gray-200 bg-white text-gray-800'
				}
			`}
		>
			{slot.char ?? <span className="text-gray-300 text-lg">–</span>}
		</motion.div>
	);
}

export default function KeySyncHero() {
	const [searchParams] = useSearchParams();
	const urlCode = searchParams.get('code') ?? undefined;
	const fromUrl = Boolean(urlCode?.match(/^[0-9]{6}$/));
	const [finished, setFinished] = useState(false);
	const navigate = useNavigate();

	const { connect, resumeWithPin } = useDeviceSync();
	const [vaultId, setVaultId] = useState<string | undefined>(undefined);
	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const deviceId = useDeviceStore((state) => state.deviceId);
	const { control, setValue, handleSubmit } = useForm<{ code: string }>({
		defaultValues: { code: '' },
	});

	const startSync = (code: string) => {
		if (!deviceId) return;
		connect('/api/v1/ws/key-sync', 'SENDER', code)
			.then(() => setFinished(true))
			.catch((ex) => {
				if (ex instanceof PinNotFoundException) {
					setVaultId(ex.vaultId);
					setIsPinModalActive(true);
				}
			});
	};

	const onSubmit = ({ code }: { code: string }) => {
		if (code.length === 6) startSync(code);
	};

	useEffect(() => {
		if (fromUrl && urlCode) {
			setValue('code', urlCode);
			startSync(urlCode);
		}
	}, [urlCode, deviceId]);

	return (
		<div className="min-h-[82vh] bg-gray-100 flex flex-col items-center justify-center px-6 py-24">
			<motion.div
				className="flex flex-col items-center gap-10 w-full max-w-xl"
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
			>
				<div className="flex flex-col items-center gap-5 text-center">
					<div className="w-20 h-20 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
						<AnimatePresence mode="wait">
							{finished ? (
								<motion.div
									key="success"
									initial={{ opacity: 0, scale: 0.7 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{
										duration: 0.3,
										ease: [0.22, 1, 0.36, 1],
									}}
								>
									<SuccessIcon />
								</motion.div>
							) : (
								<motion.div
									key="key"
									initial={{ opacity: 0, scale: 0.7 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.7 }}
									transition={{ duration: 0.2 }}
								>
									<KeyIcon />
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					<div className="flex flex-col items-center gap-2">
						<h1 className="text-4xl font-bold text-gray-900">
							Key Synchronization
						</h1>
						<p className="text-base text-gray-500 max-w-sm">
							{finished
								? 'Encryption key transferred successfully.'
								: fromUrl
									? 'Code loaded from link — syncing automatically.'
									: 'Enter the 6-digit code shown on the receiving device.'}
						</p>
					</div>
				</div>

				<Controller
					name="code"
					control={control}
					render={({ field }) => (
						<OTPInput
							{...field}
							maxLength={6}
							disabled={fromUrl || finished}
							containerClassName="flex gap-2"
							onChange={(val) => {
								field.onChange(val);
								if (val.length === 6) {
									handleSubmit(onSubmit)();
								}
							}}
							render={({ slots }) => (
								<motion.div
									className="flex gap-3"
									variants={containerVariants}
									initial="hidden"
									animate="show"
								>
									{slots.slice(0, 3).map((slot, i) => (
										<SlotBox
											key={i}
											slot={slot}
											index={i}
											finished={finished}
											fromUrl={fromUrl}
										/>
									))}

									<div className="flex items-center px-1">
										<span className="text-gray-300 text-2xl font-light">
											—
										</span>
									</div>

									{slots.slice(3).map((slot, i) => (
										<SlotBox
											key={i + 3}
											slot={slot}
											index={i + 3}
											finished={finished}
											fromUrl={fromUrl}
										/>
									))}
								</motion.div>
							)}
						/>
					)}
				/>

				<div className="flex justify-center gap-3">
					<RippleButton
						variant="outline"
						className="box-border"
						onClick={() => navigate(-1)}
					>
						Cancel
					</RippleButton>
					<RippleButton
						className="text-white"
						onClick={handleSubmit(onSubmit)}
					>
						Continue
					</RippleButton>
				</div>
			</motion.div>

			{isPinModalActive && (
				<PasswordPinModal
					setIsPinModalActive={setIsPinModalActive}
					vaultId={vaultId}
					afterPinEntered={(pin) =>
						resumeWithPin(pin).then(() => setFinished(true))
					}
				/>
			)}
		</div>
	);
}
