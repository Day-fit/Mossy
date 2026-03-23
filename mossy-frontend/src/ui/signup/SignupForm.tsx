import { useForm } from 'react-hook-form';
import {
	registerSchema,
	type RegisterSchema,
} from '../../forms/registerSchema.ts';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import RippleButton from '../layout/RippleButton.tsx';
import type { Dispatch, SetStateAction } from 'react';
import { executeRegisterRequest } from '../../api/auth.api.ts';

interface SignupFormProps {
	setResponseState: Dispatch<
		SetStateAction<{
			message: string;
			isError?: boolean;
		}>
	>;
	onSuccess: () => void;
}

export default function SignupForm({
	setResponseState,
	onSuccess,
}: SignupFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<RegisterSchema>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			username: '',
			email: '',
			password: '',
		},
	});

	const onSubmit = async (data: RegisterSchema) => {
		console.log(data);

		executeRegisterRequest(data)
			.then(async (res) => {
				const json = await res.json();
				const success = res.status === 200;

				setResponseState({
					message: json.message,
					isError: res.status !== 200,
				});

				if (success) {
					onSuccess();
				}
			})
			.catch((err) => {
				console.log(err);
			});
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="w-full flex justify-center items-center h-fit"
		>
			<motion.form
				className="bg-white shadow-2xl rounded-2xl py-10 px-20 space-y-7 w-1/3 md:w-1/2 sm:w-full my-5"
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ delay: 0.3, duration: 0.5 }}
				onSubmit={handleSubmit(onSubmit)}
			>
				<motion.img
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1, duration: 0.5 }}
					className="w-40 mx-auto mb-4"
					src="mossy_logo.png"
				/>

				<motion.h1
					className="text-4xl font-bold text-center text-emerald-800 mb-1"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.2, duration: 0.5 }}
				>
					Grow your vault
				</motion.h1>

				<motion.p className="text-center text-gray-600 text-sm">
					Your infrastructure. Your rules.
				</motion.p>

				<motion.div
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.4, duration: 0.5 }}
				>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Username
					</label>
					<input
						type="text"
						{...register('username')}
						autoComplete="username"
						className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-300"
						placeholder="Enter username..."
					/>
					<AnimatePresence>
						{errors.username && (
							<motion.p
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md"
							>
								{errors.username.message}
							</motion.p>
						)}
					</AnimatePresence>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.5, duration: 0.5 }}
				>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Email
					</label>
					<input
						type="text"
						{...register('email')}
						autoComplete="email"
						inputMode="email"
						className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-300"
						placeholder="Enter email..."
					/>
					<AnimatePresence>
						{errors.email && (
							<motion.p
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md"
							>
								{errors.email.message}
							</motion.p>
						)}
					</AnimatePresence>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.6, duration: 0.5 }}
				>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Password
					</label>
					<input
						type="password"
						{...register('password')}
						autoComplete="new-password"
						className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-300"
						placeholder="Enter password..."
					/>
					<AnimatePresence>
						{errors.password && (
							<motion.p
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md"
							>
								{errors.password.message}
							</motion.p>
						)}
					</AnimatePresence>
				</motion.div>

				<RippleButton
					type="submit"
					className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400
                              text-white font-semibold py-3 px-6 rounded-lg transition-all
                              duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
				>
					{isSubmitting ? (
						<motion.span
							animate={{ opacity: [1, 0.5, 1] }}
							transition={{ duration: 1.5, repeat: Infinity }}
						>
							Signing up...
						</motion.span>
					) : (
						'Take control'
					)}
				</RippleButton>

				<NavLink
					to="/login"
					className="text-sm text-gray-600 hover:text-gray-800 transition-colors duration-300"
				>
					Already have an account? Click here
				</NavLink>
			</motion.form>
		</motion.div>
	);
}
