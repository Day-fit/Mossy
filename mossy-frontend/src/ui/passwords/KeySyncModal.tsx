import { type Dispatch, type SetStateAction } from 'react';
import { useAuthStore } from '../../store/authStore.ts';
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
                setIsKeySyncModalActive={setIsKeySyncModalActive}
            />
        </div>
    );
}
