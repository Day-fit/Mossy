import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { OTPInput } from 'input-otp';
import { useDeviceSync } from '../../hooks/useDeviceSync.ts';
import { useDeviceStore } from '../../store/deviceStore.ts';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import { PinNotFoundException } from '../../exception/PinNotFoundException.ts';
import RippleButton from '../layout/RippleButton.tsx';

type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

const itemVariants: Variants = {
	hidden: { opacity: 0, y: 14 },
	show: {
		opacity: 1,
		y: 0,
		transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 },
	},
};

const staggerVariants: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

function SuccessCheckmark() {
	return (
		<svg width="52" height="52" viewBox="0 0 80 80">
			<circle
				cx="40"
				cy="40"
				r="35"
				fill="none"
				stroke="#d1fae5"
				strokeWidth="7"
			/>
			<motion.circle
				cx="40"
				cy="40"
				r="35"
				fill="none"
				stroke="#007735"
				strokeWidth="7"
				strokeLinecap="round"
				transform="rotate(-90 40 40)"
				initial={{ pathLength: 0 }}
				animate={{ pathLength: 1 }}
				transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
			/>
			<motion.polyline
				points="24,41 35,52 56,30"
				fill="none"
				stroke="#007735"
				strokeWidth="6"
				strokeLinecap="round"
				strokeLinejoin="round"
				initial={{ pathLength: 0 }}
				animate={{ pathLength: 1 }}
				transition={{ duration: 0.35, delay: 0.5, ease: 'easeOut' }}
			/>
		</svg>
	);
}

function SlotBox({
	slot,
	index,
	phase,
	fromUrl,
}: {
	slot: { char: string | null; isActive: boolean };
	index: number;
	phase: SyncPhase;
	fromUrl: boolean;
}) {
	const isSuccess = phase === 'success';
	const isError = phase === 'error';

	return (
		<motion.div
			variants={itemVariants}
			animate={
				isSuccess
					? {
							borderColor: ['#e5e7eb', '#007735', '#e5e7eb'],
							boxShadow: [
								'0 0 0 0px #00773500',
								'0 0 0 5px #00773520',
								'0 0 0 0px #00773500',
							],
						}
					: {}
			}
			transition={
				isSuccess ? { duration: 0.55, delay: (5 - index) * 0.07 } : {}
			}
			className={[
				'w-16 h-16 border-2 rounded-2xl flex items-center justify-center text-2xl font-semibold transition-all duration-150 select-none',
				isError
					? 'border-red-200 bg-red-50 text-red-400'
					: isSuccess
						? 'border-[#007735]/30 bg-[#f0faf4] text-[#007735]'
						: fromUrl
							? 'border-gray-200 bg-gray-100 text-gray-500'
							: slot.isActive
								? 'border-[#007735] bg-white shadow-[0_0_0_4px_#00773518]'
								: slot.char
									? 'border-gray-300 bg-white text-gray-800'
									: 'border-gray-200 bg-white text-gray-200',
			].join(' ')}
		>
			{slot.char ?? <span className="text-gray-200">·</span>}
		</motion.div>
	);
}

export default function KeySyncHero() {
	const [searchParams] = useSearchParams();
	const urlCode = searchParams.get('code') ?? undefined;
	const fromUrl = Boolean(urlCode?.match(/^[0-9]{6}$/));
	const navigate = useNavigate();

	const { control, handleSubmit, reset } = useForm<{
		code: string;
	}>({
		defaultValues: { code: '' },
	});

	const { connect, resumeWithPin } = useDeviceSync();

	const [phase, setPhase] = useState<SyncPhase>('idle');
	const [vaultId, setVaultId] = useState<string | undefined>(undefined);
	const [isPinModalActive, setIsPinModalActive] = useState(false);

	const deviceId = useDeviceStore((state) => state.deviceId);

	const startSync = useCallback(
		(syncCode: string) => {
			if (!deviceId) return;

			setPhase('syncing');

			connect('/api/v1/ws/key-sync', 'SENDER', syncCode)
				.then(() => setPhase('success'))
				.catch((ex) => {
					const isPinError =
						ex instanceof PinNotFoundException ||
						ex?.name === 'PinNotFoundException' ||
						ex?.isPinNotFoundException === true;

					if (isPinError) {
						setVaultId(ex.vaultId);
						setPhase('idle');
						setIsPinModalActive(true);
						return;
					}

					console.error('Error during sync:', ex);
					setPhase('error');
				});
		},
		[deviceId, connect]
	);

	const onSubmit = ({ code }: { code: string }) => {
		if (code.length === 6 && phase !== 'syncing') {
			startSync(code);
		}
	};

	const handleRetry = useCallback(() => {
		setPhase('idle');
		reset({ code: '' });
	}, [reset]);

	const startedRef = useRef(false);

	useEffect(() => {
		if (!fromUrl || !urlCode || !deviceId) return;
		if (startedRef.current) return;

		startedRef.current = true;
		startSync(urlCode);
	}, [urlCode, deviceId, fromUrl, startSync]);

	const isBusy = phase === 'syncing';
	const isSuccess = phase === 'success';
	const isError = phase === 'error';

	return (
		<div className="min-h-[82vh] bg-white flex flex-col">
			<div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
				<motion.div
					className="w-full max-w-lg flex flex-col items-center gap-12"
					variants={staggerVariants}
					initial="hidden"
					animate="show"
				>
					<motion.div
						variants={itemVariants}
						className="flex flex-col items-center gap-4 text-center"
					>
						<AnimatePresence mode="wait">
							{isSuccess ? (
								<motion.div
									key="success"
									initial={{ opacity: 0, scale: 0.5 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{
										duration: 0.35,
										ease: [0.22, 1, 0.36, 1],
									}}
								>
									<SuccessCheckmark />
								</motion.div>
							) : (
								<motion.div
									key="key-icon"
									initial={{ opacity: 0, scale: 0.5 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.5 }}
									transition={{ duration: 0.25 }}
									className="relative"
								>
									<div className="w-14 h-14 rounded-2xl bg-[#007735]/8 flex items-center justify-center">
										<svg
											width="26"
											height="26"
											viewBox="0 0 24 24"
											fill="none"
											stroke="#007735"
											strokeWidth="1.7"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
										</svg>
									</div>
									{isBusy && (
										<motion.div
											className="absolute -inset-1.5 rounded-3xl border-2 border-[#007735]/25"
											animate={{
												opacity: [0.7, 0.1, 0.7],
												scale: [1, 1.12, 1],
											}}
											transition={{
												duration: 1.6,
												repeat: Infinity,
												ease: 'easeInOut',
											}}
										/>
									)}
								</motion.div>
							)}
						</AnimatePresence>

						<AnimatePresence mode="wait">
							<motion.div
								key={phase}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.22 }}
								className="flex flex-col items-center gap-2"
							>
								<h1 className="text-[2rem] font-bold text-gray-900 leading-tight">
									{isSuccess
										? 'Key transferred successfully'
										: isError
											? 'Synchronization failed'
											: 'Synchronize encryption key'}
								</h1>
								<p className="text-base text-gray-400 max-w-sm leading-relaxed">
									{isSuccess
										? 'The encryption key has been securely transferred to this device.'
										: isError
											? 'Could not reach the source device. Check the code and try again.'
											: fromUrl
												? 'Code loaded from link — syncing automatically.'
												: 'Enter the 6-digit code shown on the receiving device to transfer the encryption key.'}
								</p>
							</motion.div>
						</AnimatePresence>
					</motion.div>

					<motion.div
						variants={itemVariants}
						className="w-full h-px bg-gray-100"
					/>

					<motion.div
						variants={itemVariants}
						className="flex flex-col items-center gap-3"
					>
						{!isSuccess && (
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
								Sync code
							</p>
						)}

						<Controller
							name="code"
							control={control}
							render={({ field }) => (
								<OTPInput
									{...field}
									maxLength={6}
									disabled={fromUrl || isSuccess || isBusy}
									containerClassName="flex gap-2"
									onChange={(val) => {
										if (isError && val.length < 6) {
											handleRetry();
											return;
										}

										field.onChange(val);

										if (
											val.length === 6 &&
											!isBusy &&
											!isSuccess
										) {
											handleSubmit(onSubmit)();
										}
									}}
									render={({ slots }) => (
										<motion.div
											className="flex items-center gap-2"
											variants={staggerVariants}
											initial="hidden"
											animate="show"
										>
											{slots
												.slice(0, 3)
												.map((slot, i) => (
													<SlotBox
														key={i}
														slot={slot}
														index={i}
														phase={phase}
														fromUrl={fromUrl}
													/>
												))}
											<span className="text-gray-300 text-2xl font-light select-none px-1">
												—
											</span>
											{slots.slice(3).map((slot, i) => (
												<SlotBox
													key={i + 3}
													slot={slot}
													index={i + 3}
													phase={phase}
													fromUrl={fromUrl}
												/>
											))}
										</motion.div>
									)}
								/>
							)}
						/>
					</motion.div>

					<motion.div
						variants={itemVariants}
						className="w-full h-px bg-gray-100"
					/>

					<motion.div
						variants={itemVariants}
						className="flex flex-col items-center gap-4"
					>
						<div className="flex justify-center gap-3">
							{isError ? (
								<>
									<RippleButton
										variant="outline"
										className="box-border"
										onClick={() => navigate(-1)}
									>
										Cancel
									</RippleButton>
									<RippleButton
										className="text-white bg-[#007735] hover:bg-[#005f29]"
										onClick={handleRetry}
									>
										Try again
									</RippleButton>
								</>
							) : isSuccess ? (
								<RippleButton
									className="text-white bg-[#007735] hover:bg-[#005f29]"
									onClick={() => navigate('/dashboard')}
								>
									Done
								</RippleButton>
							) : (
								<>
									<RippleButton
										variant="outline"
										className="box-border"
										onClick={() => navigate('/dashboard')}
										disabled={isBusy}
									>
										Cancel
									</RippleButton>
									{!fromUrl && (
										<RippleButton
											className="text-white bg-[#007735] hover:bg-[#005f29] disabled:opacity-40"
											onClick={handleSubmit(onSubmit)}
											disabled={isBusy}
										>
											{isBusy ? 'Syncing…' : 'Continue'}
										</RippleButton>
									)}
								</>
							)}
						</div>

						<p className="text-xs text-gray-300">
							Keys are end-to-end encrypted and never leave your
							devices unencrypted.
						</p>
					</motion.div>
				</motion.div>
			</div>

			{isPinModalActive && (
				<PasswordPinModal
					setIsPinModalActive={setIsPinModalActive}
					vaultId={vaultId}
					afterPinEntered={(pin) => {
						setIsPinModalActive(false);
						setPhase('syncing');

						resumeWithPin(pin)
							.then(() => setPhase('success'))
							.catch(() => setPhase('error'));
					}}
				/>
			)}
		</div>
	);
}
