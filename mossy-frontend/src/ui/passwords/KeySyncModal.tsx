import { type Dispatch, type SetStateAction, useState } from 'react';
import { useAuthStore } from '../../store/authStore.ts';
import VaultAccessModal from '../shared/VaultAccessModal.tsx';
import type { PreparedProtection } from '../../hooks/useEncryptionHook.ts';
import KeySyncStep from './steps/KeySyncStep.tsx';

type KeySyncModalProps = {
    setIsKeySyncModalActive: Dispatch<SetStateAction<boolean>>;
    vaultId: string;
};

export default function KeySyncModal(props: KeySyncModalProps) {
    const userId = useAuthStore((state) => state.userDetails?.userId);

    return <KeySyncDialog key={`${userId}:${props.vaultId}`} {...props} />;
}

function KeySyncDialog({
    setIsKeySyncModalActive,
    vaultId,
}: KeySyncModalProps) {
    const [protection, setProtection] = useState<PreparedProtection | null>(
        null
    );

    if (!protection) {
        return (
            <VaultAccessModal
                mode="prepare"
                vaultId={vaultId}
                onClose={() => setIsKeySyncModalActive(false)}
                onPrepared={setProtection}
            />
        );
    }

    return (
        <div
            className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-overlay p-4 overflow-hidden"
            onClick={(event) => {
                if (event.target === event.currentTarget)
                    setIsKeySyncModalActive(false);
            }}
        >
            <KeySyncStep
                vaultId={vaultId}
                protection={protection}
                setIsKeySyncModalActive={setIsKeySyncModalActive}
            />
        </div>
    );
}
