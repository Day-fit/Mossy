import {
    authCardClass,
    authInputClass,
    authButtonClass,
} from '../auth/AuthForm.tsx';
import { useForm } from 'react-hook-form';
import {
    registerSchema,
    type RegisterSchema,
} from '../../forms/registerSchema.ts';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import Button from '../shared/Button.tsx';
import type { Dispatch, SetStateAction } from 'react';
import { useAuth } from '../../hooks/useAuth.ts';
import { registerAndSignIn } from '../../auth/authFlow.ts';
import { savePendingVerification } from '../../auth/pendingVerification.ts';
import { useNavigate } from 'react-router-dom';

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
    const { login } = useAuth();
    const navigate = useNavigate();
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
        try {
            const result = await registerAndSignIn(data);
            if (result.status === 'verification-pending') {
                savePendingVerification({
                    verification: result.verification,
                    identifier: result.identifier,
                });
                navigate('/verify-email');
                return;
            }
            login(result.accessToken);
            onSuccess();
        } catch (error) {
            setResponseState({
                message:
                    error instanceof Error
                        ? error.message
                        : 'Something went wrong. Please try again later.',
                isError: true,
            });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full flex justify-center items-center h-fit"
        >
            <motion.form
                className={authCardClass}
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
                    src="/mossy_logo.png"
                    alt="Mossy Logo"
                />

                <motion.h1
                    className="type-page-title text-center text-brand mb-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    Grow your vault
                </motion.h1>

                <motion.p className="text-center text-fg-muted type-body-sm">
                    Your infrastructure. Your rules.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                >
                    <label className="block type-label text-fg-secondary mb-2">
                        Username
                    </label>
                    <input
                        type="text"
                        {...register('username')}
                        autoComplete="username"
                        className={authInputClass}
                        placeholder="Enter username..."
                    />
                    <AnimatePresence>
                        {errors.username && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 type-body-sm text-danger bg-danger-subtle px-3 py-2 rounded-md"
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
                    <label className="block type-label text-fg-secondary mb-2">
                        Email
                    </label>
                    <input
                        type="text"
                        {...register('email')}
                        autoComplete="email"
                        inputMode="email"
                        className={authInputClass}
                        placeholder="Enter email..."
                    />
                    <AnimatePresence>
                        {errors.email && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 type-body-sm text-danger bg-danger-subtle px-3 py-2 rounded-md"
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
                    <label className="block type-label text-fg-secondary mb-2">
                        Password
                    </label>
                    <input
                        type="password"
                        {...register('password')}
                        autoComplete="new-password"
                        className={authInputClass}
                        placeholder="Enter password..."
                    />
                    <AnimatePresence>
                        {errors.password && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 type-body-sm text-danger bg-danger-subtle px-3 py-2 rounded-md"
                            >
                                {errors.password.message}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </motion.div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={authButtonClass}
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
                </Button>

                <NavLink
                    to="/login"
                    className="type-body-sm text-fg-muted hover:text-fg-secondary"
                >
                    Already have an account? Click here
                </NavLink>
            </motion.form>
        </motion.div>
    );
}
