import RippleButton from '../layout/RippleButton.tsx';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
	encryptionPinSchema,
	type EncryptionPinSchema,
} from '../../forms/encryptionPinSchema.ts';
import { motion, stagger, type Variants } from 'framer-motion';
import { OTPInput } from 'input-otp';
import { useEncryptionHook } from '../../hooks/useEncryptionHook.ts';

type PasswordPinModalProps = {
	setIsPinModalActive: React.Dispatch<React.SetStateAction<boolean>>;
	vaultId?: string;
	afterPinEntered?: (pin: string) => void | Promise<void>;
	header?: string;
};

const containerVariants: Variants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: {
			duration: 0.3,
			ease: 'easeOut',
			delayChildren: stagger(0.07),
		},
	},
};

const childVariants: Variants = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function PasswordPinModal({
	setIsPinModalActive,
	vaultId,
	afterPinEntered,
	header,
}: PasswordPinModalProps) {
	const {
		handleSubmit,
		control,
		formState: { errors },
	} = useForm<EncryptionPinSchema>({
		resolver: zodResolver(encryptionPinSchema),
	});

	const { setPin } = useEncryptionHook();

	const onSubmit = async ({ pin }: EncryptionPinSchema) => {
		if (vaultId) setPin(vaultId, pin);
		if (afterPinEntered) await afterPinEntered(pin);
		setIsPinModalActive(false);
	};

	return (
		<div
			className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) setIsPinModalActive(false);
			}}
		>
			<form
				onSubmit={handleSubmit(onSubmit)}
				className="bg-white shadow-md rounded-xl w-140 flex flex-col p-8 gap-6"
			>
				<div>
					<h1 className="text-3xl font-semibold text-gray-900">
						{header ?? 'Enter your vault PIN'}
					</h1>
					<p className="text-sm text-gray-500 mt-2">
						This vault is protected by a PIN. Enter it to proceed.
					</p>
				</div>

				<div className="flex flex-col items-center gap-4 py-4">
					<Controller
						name="pin"
						control={control}
						render={({ field }) => (
							<OTPInput
								{...field}
								maxLength={4}
								containerClassName="flex gap-2"
								onChange={(val) => {
									field.onChange(val);
									if (val.length === 4) {
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
										{slots.map((slot, i) => (
											<motion.div
												key={i}
												variants={childVariants}
												className={`
                                                    w-16 h-16 border-2 rounded-lg flex items-center justify-center text-2xl font-semibold
                                                    transition-colors duration-150
                                                    ${
														slot.isActive
															? 'border-[#007735] bg-green-50 shadow-sm shadow-green-100'
															: 'border-gray-200 bg-white text-gray-800'
													}
                                                `}
											>
												{slot.char ?? (
													<span className="text-gray-300 text-lg">
														–
													</span>
												)}
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
							className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md"
						>
							{errors.pin.message}
						</motion.p>
					)}
				</div>

				<div className="flex justify-center gap-3">
					<RippleButton className="text-white" type="submit">
						Continue
					</RippleButton>
					<RippleButton
						variant="outline"
						className="box-border"
						type="reset"
						onClick={() => setIsPinModalActive(false)}
					>
						Close
					</RippleButton>
				</div>
			</form>
		</div>
	);
}
