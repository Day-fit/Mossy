import { useState } from 'react';
import { Button } from '@mossy/ui';
import {
    MdClose,
    MdDevices,
    MdErrorOutline,
    MdOpenInNew,
    MdVisibility,
    MdVisibilityOff,
} from 'react-icons/md';
import SecurityNotice from '../shared/SecurityNotice';

const registrationUrl =
    import.meta.env.VITE_MOSSY_REGISTRATION_URL?.trim() ||
    'https://mossy.dayfit.pl/register';

type Credentials = { identifier: string; password: string };

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

    return (
        <>
            <section
                className="panel login-panel"
                aria-labelledby="sign-in-title"
            >
                <div className="intro auth-intro">
                    <h2 id="sign-in-title">Welcome back</h2>
                    <p>Sign in to access your passwords.</p>
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
                    <div className="auth-field">
                        <label htmlFor="identifier">Email or username</label>
                        <input
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
                    <div className="auth-field">
                        <label htmlFor="password">Account password</label>
                        <div className="password-field">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder="Enter your account password"
                                aria-describedby={
                                    error ? 'sign-in-error' : undefined
                                }
                                disabled={loading}
                                required
                            />
                            <button
                                className="password-toggle"
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
                        <div
                            id="sign-in-error"
                            className="status error auth-feedback"
                            role="alert"
                        >
                            <MdErrorOutline size={18} aria-hidden="true" />
                            <span>{error}</span>
                            <button
                                className="icon"
                                type="button"
                                aria-label="Dismiss error"
                                onClick={onDismissError}
                            >
                                <MdClose />
                            </button>
                        </div>
                    )}
                    {enrollmentPending && !error && (
                        <div
                            className="enrollment-note auth-feedback"
                            role="status"
                        >
                            <MdDevices size={20} aria-hidden="true" />
                            <div>
                                <h3>Approve this browser</h3>
                                <p>
                                    Open Devices on a Mossy device you already
                                    use. Approve this browser, then sign in
                                    again.
                                </p>
                                <a
                                    href={instance + '/devices'}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open Devices{' '}
                                    <MdOpenInNew size={14} aria-hidden="true" />
                                </a>
                            </div>
                        </div>
                    )}
                    <div className="actions">
                        <Button
                            type="submit"
                            padding="medium"
                            disabled={loading}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </div>
                </form>
                <div className="register-link">
                    <p>
                        New to Mossy?{' '}
                        <a
                            href={registrationUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Create an account{' '}
                            <MdOpenInNew size={14} aria-hidden="true" />
                        </a>
                    </p>
                    <span className="muted">Opens in the Mossy web app</span>
                </div>
            </section>
            <SecurityNotice>
                Every secret action requires its own vault authorization.
            </SecurityNotice>
        </>
    );
}
