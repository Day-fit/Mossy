import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthTransition } from '../auth/AuthTransition.tsx';
import {
    authCardClass,
    authInputClass,
    authButtonClass,
    AuthBusyLabel,
} from '../auth/AuthForm.tsx';
import Button from '../shared/Button.tsx';
import {
    executeConfirmEmailRequest,
    executeRecoverVerificationRequest,
    executeResendVerificationRequest,
    type EmailVerification,
} from '../../api/auth.api.ts';
import { ApiError } from '../../api/client.ts';
import {
    clearPendingVerification,
    loadPendingVerification,
    savePendingVerification,
    type PendingVerification,
} from '../../auth/pendingVerification.ts';

function readLink(hash: string) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const verificationId = params.get('verificationId');
    const token = params.get('token');
    return verificationId && token ? { verificationId, token } : null;
}

export default function EmailConfirmation() {
    const location = useLocation();
    const navigate = useNavigate();
    const [pending, setPending] = useState<PendingVerification | null>(
        loadPendingVerification
    );
    const [link, setLink] = useState(() => readLink(location.hash));
    const [identifier, setIdentifier] = useState<string>(
        location.state?.identifier ?? pending?.identifier ?? ''
    );
    const [password, setPassword] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [retryAt, setRetryAt] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const expiry = pending ? Date.parse(pending.verification.expiresAt) : 0;
    const expired = pending !== null && now >= expiry;
    const resendAt = link
        ? 0
        : Date.parse(pending?.verification.resendAvailableAt ?? '') || 0;
    const wait = Math.max(
        0,
        Math.ceil((Math.max(retryAt, resendAt) - now) / 1000)
    );
    const buttonClass = authButtonClass;
    const phase = link ? 'link' : pending ? 'code' : 'recovery';

    function complete() {
        clearPendingVerification();
        navigate('/login', { replace: true, state: { emailVerified: true } });
    }

    function updateVerification(
        verification: EmailVerification | null,
        accountIdentifier: string
    ) {
        if (!verification) {
            complete();
            return;
        }
        const next = { verification, identifier: accountIdentifier };
        savePendingVerification(next);
        setPending(next);
        setLink(null);
        setCode(['', '', '', '', '', '']);
        setRetryAt(0);
        setMessage(
            'A new verification email has been requested. Use the latest code or link.'
        );
        setIsError(false);
        navigate('/verify-email', { replace: true });
    }

    async function perform(action: () => Promise<void>, sending = false) {
        setBusy(true);
        setMessage('');
        try {
            await action();
        } catch (error) {
            setIsError(true);
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong. Please try again later.'
            );
            if (sending && error instanceof ApiError && error.retryAfter)
                setRetryAt(Date.now() + error.retryAfter * 1000);
        } finally {
            setBusy(false);
        }
    }

    function confirm(event?: FormEvent) {
        event?.preventDefault();
        void perform(async () => {
            if (link) await executeConfirmEmailRequest(link);
            else if (pending)
                await executeConfirmEmailRequest({
                    verificationId: pending.verification.verificationId,
                    code: code.join(''),
                });
            else return;
            complete();
        });
    }

    function resend() {
        const id = link?.verificationId ?? pending?.verification.verificationId;
        if (!id) return;
        void perform(async () => {
            const result = await executeResendVerificationRequest(id);
            updateVerification(
                result.verification,
                pending?.verification.verificationId === id
                    ? pending.identifier
                    : identifier
            );
        }, true);
    }

    function recover(event: FormEvent) {
        event.preventDefault();
        void perform(async () => {
            try {
                const result = await executeRecoverVerificationRequest({
                    identifier,
                    password,
                });
                updateVerification(result.verification, identifier);
            } finally {
                setPassword('');
            }
        }, true);
    }

    function changeDigit(index: number, value: string) {
        if (!/^\d*$/.test(value)) return;
        setCode((previous) =>
            previous.map((digit, i) => (i === index ? value.slice(-1) : digit))
        );
        if (value && index < 5) refs.current[index + 1]?.focus();
    }

    function paste(event: ClipboardEvent<HTMLInputElement>) {
        event.preventDefault();
        const digits = event.clipboardData.getData('text').trim().slice(0, 6);
        if (!/^\d+$/.test(digits)) return;
        setCode(Array.from({ length: 6 }, (_, index) => digits[index] ?? ''));
        refs.current[Math.min(digits.length, 5)]?.focus();
    }

    function keyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Backspace' && !code[index] && index > 0)
            refs.current[index - 1]?.focus();
    }

    function showRecovery() {
        setLink(null);
        setPending(null);
        clearPendingVerification();
        setMessage('');
        navigate('/verify-email', { replace: true });
    }

    return (
        <AuthTransition transitionKey={phase}>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full flex justify-center items-center h-fit"
            >
                <motion.div
                    className={authCardClass}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
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
                        className="text-4xl font-bold text-center text-emerald-800 mb-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        Confirm your email
                    </motion.h1>
                    <AnimatePresence>
                        {message && (
                            <motion.p
                                key={message}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                role={isError ? 'alert' : 'status'}
                                className={
                                    isError
                                        ? 'text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md'
                                        : 'text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md'
                                }
                            >
                                {message}
                            </motion.p>
                        )}
                    </AnimatePresence>
                    {link ? (
                        <>
                            <p className="text-center text-gray-600 text-sm">
                                Click below to confirm your email address. This
                                link is valid for 15 minutes.
                            </p>
                            <Button
                                className={buttonClass}
                                disabled={busy}
                                onClick={() => confirm()}
                            >
                                {busy ? (
                                    <AuthBusyLabel>Confirming…</AuthBusyLabel>
                                ) : (
                                    'Confirm email'
                                )}
                            </Button>
                        </>
                    ) : pending ? (
                        <form onSubmit={confirm} className="space-y-7">
                            <p className="text-center text-gray-600 text-sm break-words">
                                Enter the six-digit code from your verification
                                email
                                {pending.identifier
                                    ? ` for ${pending.identifier}`
                                    : ''}
                                .
                            </p>
                            <p className="text-center text-sm text-gray-600">
                                {expired
                                    ? 'Your code has expired. Request a new email.'
                                    : `Code expires in ${Math.ceil((expiry - now) / 60000)} minute(s).`}
                            </p>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                                className="flex justify-center gap-2"
                            >
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(input) => {
                                            refs.current[index] = input;
                                        }}
                                        aria-label={`Code digit ${index + 1}`}
                                        className="w-10 h-12 sm:w-12 sm:h-14 min-w-0 text-center text-2xl font-bold border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-300"
                                        inputMode="numeric"
                                        autoComplete={
                                            index === 0
                                                ? 'one-time-code'
                                                : 'off'
                                        }
                                        maxLength={1}
                                        value={digit}
                                        onChange={(event) =>
                                            changeDigit(
                                                index,
                                                event.target.value
                                            )
                                        }
                                        onKeyDown={(event) =>
                                            keyDown(index, event)
                                        }
                                        onPaste={paste}
                                    />
                                ))}
                            </motion.div>
                            <Button
                                className={buttonClass}
                                disabled={
                                    busy ||
                                    expired ||
                                    code.some((digit) => !digit)
                                }
                            >
                                {busy ? (
                                    <AuthBusyLabel>Confirming…</AuthBusyLabel>
                                ) : (
                                    'Confirm email'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={recover} className="space-y-7">
                            <p className="text-center text-gray-600 text-sm">
                                Enter your account details to resume
                                verification and request a new email.
                            </p>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                            >
                                <label
                                    htmlFor="verification-identifier"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Email or username
                                </label>
                                <input
                                    id="verification-identifier"
                                    placeholder="Enter email or username..."
                                    className={authInputClass}
                                    autoComplete="username"
                                    required
                                    maxLength={254}
                                    value={identifier}
                                    onChange={(event) =>
                                        setIdentifier(event.target.value)
                                    }
                                />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6, duration: 0.5 }}
                            >
                                <label
                                    htmlFor="verification-password"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Password
                                </label>
                                <input
                                    id="verification-password"
                                    placeholder="Enter password..."
                                    className={authInputClass}
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    maxLength={1024}
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                />
                            </motion.div>
                            <Button
                                type="submit"
                                className={buttonClass}
                                disabled={busy || wait > 0}
                            >
                                {busy ? (
                                    <motion.span
                                        animate={{ opacity: [1, 0.5, 1] }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                        }}
                                    >
                                        Requesting…
                                    </motion.span>
                                ) : wait ? (
                                    `Try again in ${wait}s`
                                ) : (
                                    'Request verification email'
                                )}
                            </Button>
                        </form>
                    )}
                    {(pending || link) && (
                        <button
                            className="w-full text-sm text-emerald-700 hover:text-emerald-800 transition-colors duration-300 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer"
                            disabled={busy || wait > 0}
                            onClick={resend}
                        >
                            {wait > 0
                                ? `Resend available in ${wait}s`
                                : 'Resend verification email'}
                        </button>
                    )}
                    {(pending || link) && (
                        <button
                            className="w-full text-sm text-gray-600 hover:text-gray-800 transition-colors duration-300 disabled:cursor-not-allowed cursor-pointer"
                            disabled={busy}
                            onClick={showRecovery}
                        >
                            Resume with account details
                        </button>
                    )}
                </motion.div>
            </motion.div>
        </AuthTransition>
    );
}
