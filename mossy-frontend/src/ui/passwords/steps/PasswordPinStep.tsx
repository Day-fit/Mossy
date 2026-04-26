import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, stagger, type Variants } from 'framer-motion';
import { OTPInput } from 'input-otp';
import {
	encryptionPinSchema,
	type EncryptionPinSchema,
} from '../../../forms/encryptionPinSchema.ts';
import { useEncryptionHook } from '../../../hooks/useEncryptionHook.ts';
import RippleButton from '../../layout/RippleButton.tsx';

type PasswordPinStepProps = {
	vaultId?: string;
	onNext: (pin: string) => void | Promise<void>;
	onCancel: () => void;
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

export default function PasswordPinStep({
	vaultId,
	onNext,
	onCancel,
}: PasswordPinStepProps) {
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
		await onNext(pin);
	};

	return (
		<motion.form
			key="password-pin"
			variants={stepVariants}
			initial="enter"
			animate="center"
			exit="exit"
			onSubmit={handleSubmit(onSubmit)}
			className="bg-white shadow-md rounded-xl w-170 flex flex-col p-8 gap-6"
		>
			<div>
				<h1 className="text-3xl font-semibold text-gray-900">
					Create a PIN for your vault
				</h1>
				<p className="text-sm text-gray-500 mt-2">
					This PIN will be used to protect your encryption key. You'll
					need it every time you synchronize this vault to a new
					device.
				</p>
			</div>

			<div className="flex flex-col items-center gap-4 py-6">
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
					onClick={onCancel}
				>
					Close
				</RippleButton>
			</div>
		</motion.form>
	);
}
