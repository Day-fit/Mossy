import { useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { OTPInput } from 'input-otp';
import { useKeySyncSender } from '../../hooks/useKeySyncSender.ts';
import { useAuthStore } from '../../store/authStore.ts';
import { useDeviceStore } from '../../store/deviceStore.ts';
import VaultAccessModal from '../shared/VaultAccessModal.tsx';
import {
    isSyncCode,
    normalizeSyncCode,
    SYNC_CODE_INPUT_PATTERN,
} from '../../key-sync/code.ts';
import Button from '../shared/Button.tsx';
import KeySyncCodeGuide from './KeySyncCodeGuide.tsx';
import { globalStyleVar } from '../../theme/globalTokens.ts';

type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: {
        opacity: 1,
        y: 0,
        transition: { ease: [0.22, 1, 0.36, 1], duration: 0.45 },
    },
};

const staggerVariants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

function SuccessCheckmark() {
    return (
        <svg width="52" height="52" viewBox="0 0 80 80">
            <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke={globalStyleVar('fgBrand')}
                strokeOpacity="0.15"
                strokeWidth="7"
            />
            <motion.circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke={globalStyleVar('fgBrand')}
                strokeWidth="7"
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
            />
            <motion.polyline
                points="24,41 35,52 56,30"
                fill="none"
                stroke={globalStyleVar('fgBrand')}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, delay: 0.5, ease: 'easeOut' }}
            />
        </svg>
    );
}

function SlotBox({
    slot,
    index,
    phase,
    fromUrl,
}: {
    slot: { char: string | null; isActive: boolean };
    index: number;
    phase: SyncPhase;
    fromUrl: boolean;
}) {
    const isSuccess = phase === 'success';
    const isError = phase === 'error';
    const borderColor = globalStyleVar('borderStrong');
    const brandColor = globalStyleVar('fgBrand');

    return (
        <motion.div
            data-motion-color
            variants={itemVariants}
            animate={
                isSuccess
                    ? {
                          borderColor: [borderColor, brandColor, borderColor],
                      }
                    : {}
            }
            transition={
                isSuccess ? { duration: 0.55, delay: (5 - index) * 0.07 } : {}
            }
            className={[
                'font-mono text-2xl font-semibold w-16 h-16 border-2 rounded-2xl flex items-center justify-center select-none',
                isError
                    ? 'border-fg-danger bg-danger/5 text-fg-danger'
                    : isSuccess
                      ? 'border-fg-brand/30 bg-brand/5 text-fg-brand'
                      : fromUrl
                        ? 'border-border-strong bg-surface-muted text-fg-muted'
                        : slot.isActive
                          ? 'border-fg-brand bg-surface ring-4 ring-fg-brand/10'
                          : slot.char
                            ? 'border-border-strong bg-surface text-fg-secondary'
                            : 'border-border-strong bg-surface text-fg-disabled',
            ].join(' ')}
        >
            {slot.char ?? <span className="text-fg-disabled">·</span>}
        </motion.div>
    );
}

export default function KeySyncHero() {
    const userId = useAuthStore((state) => state.userDetails?.userId);

    return <KeySyncContent key={userId} />;
}

function KeySyncContent() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlCode = normalizeSyncCode(searchParams.get('code') ?? '');
    const fromUrl = isSyncCode(urlCode);
    const navigate = useNavigate();

    const { control, handleSubmit, reset } = useForm<{
        code: string;
    }>({
        defaultValues: { code: fromUrl ? urlCode : '' },
    });

    const sender = useKeySyncSender();
    const { send, reset: resetSender } = sender;
    const phase: SyncPhase =
        sender.phase === 'needs-unlock' ? 'idle' : sender.phase;

    const deviceId = useDeviceStore((state) => state.deviceId);

    const onSubmit = ({ code }: { code: string }) => {
        if (isSyncCode(code) && sender.phase !== 'syncing' && deviceId) {
            void send(code);
        }
    };

    const handleRetry = useCallback(() => {
        resetSender();
        reset({ code: '' });
        setSearchParams({}, { replace: true });
    }, [reset, resetSender, setSearchParams]);

    useEffect(() => {
        if (!fromUrl || !deviceId) return;
        let disposed = false;
        queueMicrotask(() => {
            if (!disposed) void send(urlCode);
        });
        return () => {
            disposed = true;
        };
    }, [urlCode, deviceId, fromUrl, send]);

    const isBusy = phase === 'syncing';
    const isSuccess = phase === 'success';
    const isError = phase === 'error';

    return (
        <div className="flex-1 bg-surface-page flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
                <motion.div
                    className="w-full max-w-lg flex flex-col items-center gap-12"
                    variants={staggerVariants}
                    initial="hidden"
                    animate="show"
                >
                    <motion.div
                        variants={itemVariants}
                        className="flex flex-col items-center gap-4 text-center"
                    >
                        <AnimatePresence mode="wait">
                            {isSuccess ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{
                                        duration: 0.35,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                >
                                    <SuccessCheckmark />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="key-icon"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ duration: 0.25 }}
                                    className="relative"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-brand/8 flex items-center justify-center">
                                        <svg
                                            width="26"
                                            height="26"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke={globalStyleVar('fgBrand')}
                                            strokeWidth="1.7"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                        </svg>
                                    </div>
                                    {isBusy && (
                                        <motion.div
                                            className="absolute -inset-1.5 rounded-3xl border-2 border-fg-brand/25"
                                            animate={{
                                                opacity: [0.7, 0.1, 0.7],
                                                scale: [1, 1.12, 1],
                                            }}
                                            transition={{
                                                duration: 1.6,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                            }}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={phase}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <h1 className="text-4xl leading-tight">
                                    {isSuccess
                                        ? 'Key transferred successfully'
                                        : isError
                                          ? 'Synchronization failed'
                                          : 'Synchronize encryption key'}
                                </h1>
                                <p className="text-fg-subtle max-w-sm">
                                    {isSuccess
                                        ? 'The encryption key has been securely sent to the receiving device.'
                                        : isError
                                          ? sender.error
                                          : fromUrl
                                            ? 'Code loaded from the receiving device.'
                                            : 'Enter the six-character code from the receiving device here, on the device that already has the key.'}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>

                    <motion.div
                        variants={itemVariants}
                        className="w-full h-px bg-surface-muted"
                    />

                    <motion.div
                        variants={itemVariants}
                        className="w-full flex flex-col items-center gap-3"
                    >
                        {!isSuccess && (
                            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-fg-subtle">
                                Sync code
                            </p>
                        )}

                        <Controller
                            name="code"
                            control={control}
                            render={({ field }) => (
                                <OTPInput
                                    {...field}
                                    maxLength={6}
                                    inputMode="text"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    aria-label="Sync code"
                                    pattern={SYNC_CODE_INPUT_PATTERN}
                                    pasteTransformer={normalizeSyncCode}
                                    disabled={
                                        fromUrl ||
                                        isSuccess ||
                                        isBusy ||
                                        sender.phase === 'needs-unlock'
                                    }
                                    containerClassName="flex gap-2"
                                    onChange={(val) => {
                                        if (isError && val.length < 6) {
                                            handleRetry();
                                            return;
                                        }

                                        const code = normalizeSyncCode(val);
                                        field.onChange(code);

                                        if (
                                            isSyncCode(code) &&
                                            !isBusy &&
                                            !isSuccess
                                        ) {
                                            handleSubmit(onSubmit)();
                                        }
                                    }}
                                    render={({ slots }) => (
                                        <motion.div
                                            className="flex items-center gap-2"
                                            variants={staggerVariants}
                                            initial="hidden"
                                            animate="show"
                                        >
                                            {slots
                                                .slice(0, 3)
                                                .map((slot, i) => (
                                                    <SlotBox
                                                        key={i}
                                                        slot={slot}
                                                        index={i}
                                                        phase={phase}
                                                        fromUrl={fromUrl}
                                                    />
                                                ))}
                                            <span className="font-mono text-2xl font-semibold text-fg-disabled select-none px-1">
                                                —
                                            </span>
                                            {slots.slice(3).map((slot, i) => (
                                                <SlotBox
                                                    key={i + 3}
                                                    slot={slot}
                                                    index={i + 3}
                                                    phase={phase}
                                                    fromUrl={fromUrl}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                />
                            )}
                        />

                        {!fromUrl && !isSuccess && !isBusy && (
                            <KeySyncCodeGuide />
                        )}
                    </motion.div>

                    <motion.div
                        variants={itemVariants}
                        className="w-full h-px bg-surface-muted"
                    />

                    <motion.div
                        variants={itemVariants}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="flex justify-center gap-3">
                            {isError ? (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate(-1)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleRetry}>
                                        Try again
                                    </Button>
                                </>
                            ) : isSuccess ? (
                                <Button onClick={() => navigate('/dashboard')}>
                                    Done
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate('/dashboard')}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="disabled:opacity-40"
                                        onClick={handleSubmit(onSubmit)}
                                        disabled={isBusy || !deviceId}
                                    >
                                        {isBusy ? 'Syncing…' : 'Continue'}
                                    </Button>
                                </>
                            )}
                        </div>

                        <p className="text-xs text-fg-disabled">
                            Keys are end-to-end encrypted and never leave your
                            devices unencrypted.
                        </p>
                    </motion.div>
                </motion.div>
            </div>

            {sender.phase === 'needs-unlock' && sender.vaultId && (
                <VaultAccessModal
                    mode="unlock"
                    vaultId={sender.vaultId}
                    onClose={sender.cancelUnlock}
                    onSuccess={() => {
                        void send(sender.code);
                    }}
                />
            )}
        </div>
    );
}
