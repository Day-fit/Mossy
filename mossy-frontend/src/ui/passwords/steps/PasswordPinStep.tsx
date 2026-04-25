import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, stagger, type Variants } from 'framer-motion';
import { OTPInput } from 'input-otp';
import { IoKeyOutline } from 'react-icons/io5';
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
		<form
			onSubmit={handleSubmit(async ({ pin }) => {
				if (vaultId) setPin(vaultId, pin);
				await onNext(pin);
			})}
			className="bg-white shadow-md rounded-md w-2/3 h-3/4 flex flex-col items-center"
		>
			<h1 className="text-3xl mt-5">
				Please type vault key pin to proceed
			</h1>
			<IoKeyOutline className="h-20 text-9xl mt-2 mb-5" />
			<Controller
				name="pin"
				control={control}
				render={({ field }) => (
					<OTPInput
						{...field}
						maxLength={4}
						containerClassName="flex gap-2 mt-2"
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
											w-16 h-16 border-2 rounded-md flex items-center justify-center text-3xl font-bold
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
			<div className="flex gap-2 mt-5">
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
		</form>
	);
}
