import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@mossy/ui';
import {
    MdDevices,
    MdOpenInNew,
    MdVisibility,
    MdVisibilityOff,
} from 'react-icons/md';
import SecurityNotice from '../shared/SecurityNotice';
import Feedback from '../shared/Feedback';

const registrationUrl =
    import.meta.env.VITE_MOSSY_REGISTRATION_URL?.trim() ||
    'https://mossy.dayfit.pl/register';

type Credentials = { identifier: string; password: string };

const inputClassName =
    'block min-h-12 w-full min-w-0 rounded-lg border-2 border-border-strong bg-surface py-3 pl-3 text-[0.8125rem] leading-normal text-fg-primary placeholder:text-fg-subtle placeholder:opacity-100 focus-visible:border-fg-brand focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-fg-danger';

export default function SignIn({
    instance,
    loading,
    error,
    enrollmentPending,
    onSignIn,
    onDismissError,
}: {
    instance: string;
    loading: boolean;
    error?: string;
    enrollmentPending: boolean;
    onSignIn: (credentials: Credentials) => Promise<void>;
    onDismissError: () => void;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const reduce = useReducedMotion();

    return (
        <>
            <section
                className="min-w-0 border-border border-2 rounded-xl bg-surface p-6 shadow-card max-[400px]:p-4"
                aria-labelledby="sign-in-title"
            >
                <div className="mb-2 text-fg-muted text-center">
                    <h2
                        id="sign-in-title"
                        className="text-[1.75rem] leading-[1.4] text-fg-brand"
                    >
                        Welcome back
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-56 text-[0.8125rem] leading-[1.6]">
                        Sign in to access your passwords.
                    </p>
                </div>
                <form
                    aria-label="Sign in"
                    aria-busy={loading}
                    onSubmit={(event) => {
                        event.preventDefault();

                        const form = event.currentTarget;
                        const data = new FormData(form);
                        const credentials = {
                            identifier: String(data.get('identifier')),
                            password: String(data.get('password')),
                        };
                        // Keep credentials out of React state, including while visible.
                        (
                            form.elements.namedItem(
                                'password'
                            ) as HTMLInputElement
                        ).value = '';
                        data.delete('password');
                        setShowPassword(false);
                        void onSignIn(credentials).finally(() => {
                            credentials.password = '';
                        });
                    }}
                >
                    <div className="mt-4">
                        <label
                            className="mb-2 block text-[0.8125rem] font-medium text-fg-secondary"
                            htmlFor="identifier"
                        >
                            Email or username
                        </label>
                        <input
                            className={`${inputClassName} pr-3`}
                            id="identifier"
                            name="identifier"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="Enter your email or username"
                            disabled={loading}
                            required
                        />
                    </div>
                    <div className="mt-4">
                        <label
                            className="mb-2 block text-[0.8125rem] font-medium text-fg-secondary"
                            htmlFor="password"
                        >
                            Account password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                className={`${inputClassName} pr-12`}
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder="Enter your account password"
                                aria-describedby={
                                    error ? 'sign-in-error' : undefined
                                }
                                aria-invalid={!!error}
                                disabled={loading}
                                required
                            />
                            <button
                                className="absolute inset-y-1 right-1 inline-flex w-10 items-center justify-center rounded-md border-0 bg-transparent p-0 text-fg-muted hover:bg-surface-subtle hover:text-fg-brand focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98]"
                                type="button"
                                aria-label={
                                    showPassword
                                        ? 'Hide account password'
                                        : 'Show account password'
                                }
                                aria-pressed={showPassword}
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={loading}
                            >
                                {showPassword ? (
                                    <MdVisibilityOff size={19} />
                                ) : (
                                    <MdVisibility size={19} />
                                )}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <Feedback
                            id="sign-in-error"
                            className="mt-4"
                            onDismiss={onDismissError}
                        >
                            {error}
                        </Feedback>
                    )}
                    {enrollmentPending && !error && (
                        <motion.div
                            className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface-subtle p-3.5"
                            role="status"
                            initial={reduce ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: reduce ? 0 : 0.22,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                        >
                            <MdDevices
                                className="mt-0.5 shrink-0 text-fg-brand"
                                size={20}
                                aria-hidden="true"
                            />
                            <div>
                                <h3 className="text-sm leading-[1.4]">
                                    Approve this browser
                                </h3>
                                <p className="mt-1.5 mb-2.5 text-xs leading-[1.6] text-fg-muted">
                                    Open Devices on a Mossy device you already
                                    use. Approve this browser, then sign in
                                    again.
                                </p>
                                <a
                                    className="inline-flex items-center gap-1.25 text-xs font-semibold text-fg-brand underline-offset-3 hover:text-fg-brand-hover hover:underline"
                                    href={instance + '/devices'}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open Devices{' '}
                                    <MdOpenInNew size={14} aria-hidden="true" />
                                </a>
                            </div>
                        </motion.div>
                    )}
                    <div className="actions mt-5 flex gap-2.5">
                        <Button
                            className="inline-flex items-center justify-center gap-1.75 whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-11 text-[0.8125rem] w-full"
                            type="submit"
                            padding="medium"
                            disabled={loading}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </div>
                </form>
                <div className="mt-5 border-t border-border pt-4.5 text-center">
                    <p className="text-[0.8125rem] leading-[1.6] text-fg-secondary">
                        New to Mossy?{' '}
                        <a
                            className="inline-flex items-center gap-1 font-semibold text-fg-brand underline-offset-3 hover:text-fg-brand-hover hover:underline"
                            href={registrationUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Create an account{' '}
                            <MdOpenInNew size={14} aria-hidden="true" />
                        </a>
                    </p>
                    <span className="mt-1 block text-xs text-fg-muted">
                        Opens in the Mossy web app
                    </span>
                </div>
            </section>
            <SecurityNotice>
                Every secret action requires its own vault authorization.
            </SecurityNotice>
        </>
    );
}
