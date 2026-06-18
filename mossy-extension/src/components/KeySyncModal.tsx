import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDeviceSync } from '../hooks/useDeviceSync';
import { useEncryptionHook } from '../hooks/useEncryptionHook';
import { KEYSYNC_WS } from '../utils/constants';
import {
  input,
  primaryButton,
  secondaryButton,
  sectionHeader,
  statusError,
  subtitle,
} from './popupStyles';

type KeySyncModalProps = {
  vaultId: string;
  onClose: () => void;
  onSynchronized: (pin: string) => void;
};

type ModalStep = 'pin' | 'sync' | 'success';

export default function KeySyncModal({ vaultId, onClose, onSynchronized }: KeySyncModalProps) {
  const { setPin } = useEncryptionHook();
  const { initializeKeySync, connectReceiver, disconnect } = useDeviceSync();
  const [step, setStep] = useState<ModalStep>('pin');
  const [pin, setPinValue] = useState('');
  const [syncCode, setSyncCode] = useState('');
  const [error, setError] = useState('');

  const canContinue = useMemo(() => /^\d{4}$/.test(pin), [pin]);

  useEffect(() => {
    if (step !== 'sync') return;
    let canceled = false;

    void initializeKeySync(vaultId)
      .then((code) => {
        if (!canceled) setSyncCode(code);
      })
      .catch((e) => {
        if (!canceled) setError(e instanceof Error ? e.message : 'Failed to initialize key sync');
      });

    return () => {
      canceled = true;
    };
  }, [initializeKeySync, step, vaultId]);

  useEffect(() => {
    if (step !== 'sync' || !syncCode || !canContinue) return;
    let canceled = false;

    void connectReceiver(KEYSYNC_WS, syncCode, pin)
      .then(() => {
        if (canceled) return;
        setStep('success');
        onSynchronized(pin);
        setTimeout(() => onClose(), 1200);
      })
      .catch((e) => {
        if (canceled) return;
        setError(e instanceof Error ? e.message : 'Key sync failed');
      });

    return () => {
      canceled = true;
    };
  }, [canContinue, connectReceiver, onClose, onSynchronized, pin, step, syncCode]);

  function closeModal() {
    disconnect();
    onClose();
  }

  function goToSyncStep() {
    if (!canContinue) return;
    setPin(vaultId, pin);
    setError('');
    setSyncCode('');
    setStep('sync');
  }

  return (
    <motion.div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => (e.target === e.currentTarget ? closeModal() : undefined)}
    >
      <motion.section
        className="flex w-full max-w-[360px] flex-col gap-4 overflow-hidden rounded-lg bg-white p-5 shadow-xl"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {step === 'pin' ? (
            <motion.div
              key="pin"
              className="flex flex-col gap-4"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className={sectionHeader}>
                <p className="text-[11px] font-bold uppercase text-gray-500">
                  Key sync
                </p>
                <h2 className="text-[22px] font-semibold leading-tight text-gray-900">
                  Create a vault PIN
                </h2>
                <p className={subtitle}>
                  This PIN protects the synchronized key on this device.
                </p>
              </div>
              <input
                className={input}
                autoFocus
                value={pin}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit PIN"
              />
              <div className="flex gap-2">
                <button className={primaryButton} onClick={goToSyncStep} disabled={!canContinue}>
                  Continue
                </button>
                <button className={secondaryButton} onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : null}

          {step === 'sync' ? (
            <motion.div
              key="sync"
              className="flex flex-col gap-4"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className={sectionHeader}>
                <p className="text-[11px] font-bold uppercase text-gray-500">
                  Receiver ready
                </p>
                <h2 className="text-[22px] font-semibold leading-tight text-gray-900">
                  Synchronize key
                </h2>
                <p className={subtitle}>
                  Open key sync in the Mossy web app and enter this code.
                </p>
              </div>
              <input
                className={`${input} text-center text-lg font-semibold tracking-wider`}
                readOnly
                value={syncCode || 'Generating code...'}
              />
              <p className={subtitle}>Waiting for sender device...</p>
              <div className="flex gap-2">
                <button className={secondaryButton} onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : null}

          {step === 'success' ? (
            <motion.div
              key="success"
              className="flex flex-col gap-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <p className="text-[11px] font-bold uppercase text-gray-500">
                Complete
              </p>
              <h2 className="text-[22px] font-semibold leading-tight text-gray-900">
                Key synchronized
              </h2>
              <p className={subtitle}>
                Your vault key is now available on this device.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? <p className={statusError}>{error}</p> : null}
      </motion.section>
    </motion.div>
  );
}
