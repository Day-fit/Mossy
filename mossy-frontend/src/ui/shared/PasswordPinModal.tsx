import RippleButton from '../layout/RippleButton.tsx';
import * as React from 'react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	encryptionPinSchema,
	type EncryptionPinSchema,
} from '../../forms/encryptionPinSchema.ts';
import { motion, stagger, type Variants } from 'framer-motion';
import { OTPInput } from 'input-otp';
import { IoKeyOutline } from 'react-icons/io5';
import { useEncryptionContext } from '../../context/EncryptionContext.tsx';

type PasswordPinModalProps = {
	setIsPinModalActive: React.Dispatch<React.SetStateAction<boolean>>;
	vaultId?: string;
	afterPinEntered?: (pin: string) => void;
};

export default function PasswordPinModal({
	setIsPinModalActive,
	vaultId,
	afterPinEntered,
}: PasswordPinModalProps) {
	const [isSubmittingPin, setIsSubmittingPin] = useState(false);
	const {
		handleSubmit,
		control,
		formState: { errors },
	} = useForm<EncryptionPinSchema>({
		resolver: zodResolver(encryptionPinSchema),
	});

	const { setEncryptionPin } = useEncryptionContext();

	const containerVariants: Variants = {
		hidden: { opacity: 0, y: 50, scale: 0.98 },
		show: {
			opacity: 1,
			y: 0,
			scale: 1,
			transition: {
				duration: 0.5,
				ease: 'easeOut',
				delayChildren: stagger(0.2),
			},
		},
	};

	const childVariants: Variants = {
		hidden: { opacity: 0, y: 50 },
		show: { opacity: 1, y: 0 },
	};

	return (
		<div
			className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) setIsPinModalActive(false);
			}}
		>
			<form
				onSubmit={handleSubmit(async (data) => {
					setIsSubmittingPin(true);
					const pin = data.pin;
					if (vaultId) {
						setEncryptionPin((prev) => ({
							...prev,
							[vaultId]: pin,
						}));
					}

					try {
						if (afterPinEntered) {
							await afterPinEntered(pin);
						}
						setIsPinModalActive(false);
					} finally {
						setIsSubmittingPin(false);
					}
				})}
				className="flex h-auto min-h-[24rem] w-full max-w-md flex-col items-center rounded-md bg-white p-4 shadow-md sm:p-6 md:max-w-xl"
			>
				<h1 className="mt-3 text-center text-xl sm:text-2xl md:text-3xl">
					Please type vault key pin to proceed
				</h1>

				<IoKeyOutline className="mb-4 mt-2 h-16 text-7xl sm:h-20 sm:text-8xl md:text-9xl" />

				<Controller
					name="pin"
					control={control}
					render={({ field }) => (
						<OTPInput
							{...field}
							maxLength={4}
							containerClassName="mt-2 flex gap-2"
							render={({ slots }) => (
								<motion.div
									className="flex gap-1"
									variants={containerVariants}
									initial="hidden"
									animate="show"
								>
									{slots.map((slot, i) => (
										<motion.div
											key={i}
											variants={childVariants}
											className={`
												flex h-12 w-12 items-center justify-center rounded-md border-2 text-2xl font-bold sm:h-14 sm:w-14 sm:text-3xl
												transition-colors duration-150
												${
													slot.isActive
														? 'border-green-500 bg-green-50 shadow-md shadow-green-200'
														: 'border-gray-300 bg-white'
												}
											`}
										>
											{slot.char ?? '_'}
										</motion.div>
									))}
								</motion.div>
							)}
						/>
					)}
				/>

				{errors.pin && (
					<motion.p
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md"
					>
						{errors.pin.message}
					</motion.p>
				)}

				<div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
					<RippleButton
						className="text-white"
						type="submit"
						disabled={isSubmittingPin}
					>
						Continue
					</RippleButton>

					<RippleButton
						variant="outline"
						className="box-border"
						type="reset"
						disabled={isSubmittingPin}
						onClick={() => setIsPinModalActive(false)}
					>
						Close
					</RippleButton>
				</div>
			</form>
		</div>
	);
}
