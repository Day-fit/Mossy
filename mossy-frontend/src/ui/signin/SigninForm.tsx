import {
    authCardClass,
    authInputClass,
    authButtonClass,
} from '../auth/AuthForm.tsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import Button from '../shared/Button.tsx';
import type { Dispatch, SetStateAction } from 'react';
import { loginSchema, type LoginSchema } from '../../forms/loginSchema.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { signIn } from '../../auth/authFlow.ts';
import { ApiError } from '../../api/client.ts';
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

export default function SigninForm({
    setResponseState,
    onSuccess,
}: SignupFormProps) {
    const { login } = useAuth();
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginSchema>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            identifier: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginSchema) => {
        try {
            const result = await signIn(data);
            if (result.status === 'enrollment-pending') {
                setResponseState({
                    message:
                        'Device enrollment requested. Approve it from an existing device, then sign in again.',
                    isError: false,
                });
                return;
            }

            login(result.accessToken);
            onSuccess();
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.code === 'EMAIL_VERIFICATION_REQUIRED'
            ) {
                navigate('/verify-email', {
                    state: { identifier: data.identifier },
                });
                return;
            }
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
                    className="text-4xl font-bold leading-[1.1] text-center text-brand mb-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    Welcome back
                </motion.h1>

                <motion.p className="text-center text-fg-muted text-sm">
                    Your passwords are waiting on your server.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                >
                    <label className="block text-sm font-medium text-fg-secondary mb-2">
                        Email / Username
                    </label>
                    <input
                        type="text"
                        {...register('identifier')}
                        autoComplete="username"
                        className={authInputClass}
                        placeholder="Enter email or username..."
                    />
                    <AnimatePresence>
                        {errors.identifier && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 text-sm text-danger bg-danger/5 px-3 py-2 rounded-md"
                            >
                                {errors.identifier.message}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                >
                    <label className="block text-sm font-medium text-fg-secondary mb-2">
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
                                className="mt-2 text-sm text-danger bg-danger/5 px-3 py-2 rounded-md"
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
                            Signing in...
                        </motion.span>
                    ) : (
                        'Enter vault'
                    )}
                </Button>

                <NavLink
                    to="/register"
                    className="text-sm text-fg-muted hover:text-fg-secondary"
                >
                    Don't have an account? Click here
                </NavLink>
                <NavLink
                    to="/verify-email"
                    className="block text-sm text-brand"
                >
                    Resume email verification
                </NavLink>
            </motion.form>
        </motion.div>
    );
}
