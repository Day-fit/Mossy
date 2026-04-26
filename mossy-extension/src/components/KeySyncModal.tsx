import { useEffect, useMemo, useState } from 'react';
import { useDeviceSync } from '../hooks/useDeviceSync';
import { useEncryptionHook } from '../hooks/useEncryptionHook';
import { KEYSYNC_WS } from '../utils/constants';

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
    <div className="modal-backdrop" onClick={(e) => (e.target === e.currentTarget ? closeModal() : undefined)}>
      <section className="modal-card">
        {step === 'pin' ? (
          <>
            <h2 className="modal-title">Create a PIN for your vault</h2>
            <p className="small">This PIN protects your synchronized key on this device.</p>
            <input
              autoFocus
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit PIN"
            />
            <div className="row">
              <button onClick={goToSyncStep} disabled={!canContinue}>
                Continue
              </button>
              <button className="secondary" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </>
        ) : null}

        {step === 'sync' ? (
          <>
            <h2 className="modal-title">Synchronize encryption key</h2>
            <p className="small">On your trusted Mossy web app, open key sync and enter this code.</p>
            <input readOnly value={syncCode || 'Generating code...'} />
            <p className="small">Waiting for sender device…</p>
            <div className="row">
              <button className="secondary" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </>
        ) : null}

        {step === 'success' ? (
          <>
            <h2 className="modal-title">Key synchronized</h2>
            <p className="small">Your vault key is now available on this device.</p>
          </>
        ) : null}

        {error ? <p className="status-err">{error}</p> : null}
      </section>
    </div>
  );
}
