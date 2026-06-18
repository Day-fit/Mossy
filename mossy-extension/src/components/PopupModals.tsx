import KeySyncModal from "./KeySyncModal";
import PasswordPinModal from "./PasswordPinModal";
import { usePopupController } from "../hooks/usePopupController";

export default function PopupModals() {
  const {
    selectedVaultId,
    isPinModalActive,
    setIsPinModalActive,
    isKeySyncModalActive,
    setIsKeySyncModalActive,
    keySyncVaultId,
    setPin,
    runPendingAction,
    setStatus,
  } = usePopupController();

  return (
    <>
      {isPinModalActive && selectedVaultId ? (
        <PasswordPinModal
          vaultId={selectedVaultId}
          onClose={() => setIsPinModalActive(false)}
          onPinEntered={async (pin) => {
            setIsPinModalActive(false);
            setPin(selectedVaultId, pin);
            await runPendingAction();
          }}
        />
      ) : null}

      {isKeySyncModalActive && keySyncVaultId ? (
        <KeySyncModal
          vaultId={keySyncVaultId}
          onClose={() => setIsKeySyncModalActive(false)}
          onSynchronized={async () => {
            setStatus({ type: "success", message: "Key synchronized" });
            await runPendingAction();
          }}
        />
      ) : null}
    </>
  );
}
