import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import Button from '../../shared/Button.tsx';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useKeySyncReceiver } from '../../../hooks/useKeySyncReceiver.ts';
import QRCodeStyling, { type Options } from 'qr-code-styling';
import SyncSuccessView from './SyncSuccessView.tsx';
import { resolveGlobalStyleToken } from '../../../theme/globalTokens.ts';

type KeySyncModalProps = {
    vaultId: string;
    pin: string;
    setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
};

function createQrConfig(): Partial<Options> {
    const brandColor = resolveGlobalStyleToken('brand');

    return {
        width: 240,
        height: 240,
        type: 'svg',
        data: '',
        image: '/mossy_logo.png',
        margin: 12,
        qrOptions: {
            errorCorrectionLevel: 'H',
        },
        dotsOptions: {
            type: 'rounded',
            color: brandColor,
        },
        backgroundOptions: {
            color: resolveGlobalStyleToken('qrSurface'),
        },
        imageOptions: {
            crossOrigin: 'anonymous',
            margin: 6,
            imageSize: 0.28,
        },
        cornersSquareOptions: {
            type: 'extra-rounded',
            color: brandColor,
        },
        cornersDotOptions: {
            type: 'dot',
            color: brandColor,
        },
    };
}

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

export default function KeySyncStep({
    vaultId,
    pin,
    setIsKeySyncModalActive,
}: KeySyncModalProps) {
    const receiver = useKeySyncReceiver(vaultId, pin);
    const qrCodeRef = useRef<HTMLDivElement>(null);
    const synced = receiver.phase === 'success';
    const syncCode = receiver.code;

    useEffect(() => {
        if (!synced) return;
        const timer = setTimeout(() => setIsKeySyncModalActive(false), 3500);
        return () => clearTimeout(timer);
    }, [synced, setIsKeySyncModalActive]);

    useEffect(() => {
        if (!syncCode) return;
        if (!qrCodeRef.current) return;

        const el = qrCodeRef.current;
        el.innerHTML = '';

        const qr = new QRCodeStyling({
            ...createQrConfig(),
            data: `${window.location.origin}/key-sync?code=${syncCode}`,
        });

        qr.append(el);

        return () => {
            el.innerHTML = '';
        };
    }, [syncCode]);

    return (
        <motion.div
            key="key-sync"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="bg-surface shadow-card rounded-md lg:w-2/3 md:w-full h-3/4 flex flex-col justify-between items-center p-5 overflow-hidden"
        >
            <AnimatePresence mode="wait">
                {synced ? (
                    <motion.div
                        key="success"
                        className="flex items-center justify-center w-full h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <SyncSuccessView />
                    </motion.div>
                ) : (
                    <motion.div
                        key="qr"
                        className="flex flex-col justify-between items-center w-full h-full"
                        exit={{
                            opacity: 0,
                            scale: 0.95,
                            transition: { duration: 0.2 },
                        }}
                    >
                        <div>
                            <h2 className="text-3xl">
                                To use this vault, please synchronize encryption
                                key
                            </h2>
                            <p className="text-sm text-fg-muted mt-2">
                                As encryption keys are stored on your device,
                                only way to use them somewhere else is
                                synchronization
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div
                                ref={qrCodeRef}
                                className="w-60 h-60 overflow-hidden rounded-xl bg-qr-surface flex justify-center items-center subpixel-antialiased"
                                style={{
                                    transform: 'translateZ(0)',
                                    backfaceVisibility: 'hidden',
                                }}
                            />
                            <p className="text-sm text-center text-fg-muted">
                                Scan the QR code, or go to{' '}
                                <span className="font-mono text-fg-secondary">
                                    {window.origin}/key-sync
                                </span>{' '}
                                on the device that has access to this vault and
                                enter the code below.
                            </p>
                            <input
                                type="text"
                                aria-label="Sync code"
                                value={syncCode || ''}
                                placeholder={
                                    receiver.phase === 'error'
                                        ? 'No active sync code'
                                        : 'Preparing secure transfer…'
                                }
                                readOnly
                                className="font-mono text-sm w-full rounded-md border border-border-strong bg-surface-subtle px-3 py-2 text-center text-fg-secondary"
                            />
                            {receiver.phase === 'saving' && (
                                <p role="status">Saving your vault key…</p>
                            )}
                            {receiver.error && (
                                <p
                                    role="alert"
                                    className="text-sm text-fg-danger text-center"
                                >
                                    {receiver.error}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2 mt-5">
                            {receiver.phase === 'error' && (
                                <Button onClick={receiver.retry}>
                                    Try again
                                </Button>
                            )}
                            <Button
                                onClick={() => {
                                    setIsKeySyncModalActive(false);
                                }}
                                variant="outline"
                            >
                                Cancel
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
