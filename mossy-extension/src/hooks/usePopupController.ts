import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  executePasswordCiphertextRequest,
  executePasswordMetadataRequest,
  executeSavePasswordRequest,
} from "../api/password.api";
import { executeUserVaultsRequest } from "../api/vault.api";
import { KeyNotFoundException } from "../exception/KeyNotFoundException";
import { useAuthInit } from "./useAuthInit";
import { useDeviceBootstrap } from "./useDeviceBootstrap";
import { useEncryptionHook } from "./useEncryptionHook";
import { useAuthStore } from "../store/authStore";
import { useCapturedStore } from "../store/capturedStore";
import { useEncryptionStore } from "../store/encryptionStore";
import { usePasswordsStore } from "../store/passwordsStore";
import { useRevealedStore } from "../store/revealedStore";
import { useVaultStore } from "../store/vaultStore";
import type { CapturedCredential } from "../types";
import {
  loadCapturedCredentials,
  saveCapturedCredentials,
} from "../utils/chromeStorage";
import { normalizeDomain } from "../utils/domain";

export type SaveValues = {
  identifier: string;
  password: string;
  domain: string;
};

export type StatusMessage = {
  type: "success" | "error";
  message: string;
} | null;

export type CiphertextPhase = "Fetching" | "Decrypting";

export type PopupControllerValue = ReturnType<typeof usePopupControllerValue>;

export const PopupControllerContext =
  createContext<PopupControllerValue | null>(null);

export function usePopupController() {
  const value = useContext(PopupControllerContext);

  if (!value) {
    throw new Error(
      "usePopupController must be used within PopupControllerProvider",
    );
  }

  return value;
}

export function usePopupControllerValue() {
  useAuthInit();

  const { isAuthenticated, userDetails } = useAuthStore();
  const { vaults, selectedVaultId, setVaults } = useVaultStore();
  const { setPin } = useEncryptionStore();
  const { captured, setCaptured } = useCapturedStore();
  const { setPasswords } = usePasswordsStore();
  const { setRevealedPassword } = useRevealedStore();

  const { bootstrapDevice } = useDeviceBootstrap();
  const { encrypt, decrypt, isPinPresent } = useEncryptionHook();

  const [status, setStatus] = useState<StatusMessage>(null);
  const [isPinModalActive, setIsPinModalActive] = useState(false);
  const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);
  const [keySyncVaultId, setKeySyncVaultId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const [loadingCiphertextPhase, setLoadingCiphertextPhase] = useState<
    Record<string, CiphertextPhase>
  >({});
  const initializedUserIdRef = useRef<string | null>(null);

  const selectedVault = useMemo(
    () => vaults.find((vault) => vault.vaultId === selectedVaultId) ?? null,
    [vaults, selectedVaultId],
  );

  const refreshVaults = useCallback(async () => {
    const result = await executeUserVaultsRequest();
    setVaults(result);
  }, [setVaults]);

  const refreshPasswords = useCallback(async () => {
    if (!selectedVaultId) return;

    const metadata = await executePasswordMetadataRequest(selectedVaultId);
    setPasswords(
      metadata.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime(),
      ),
    );
  }, [selectedVaultId, setPasswords]);

  useEffect(() => {
    if (isAuthenticated !== true || !userDetails?.userId) {
      initializedUserIdRef.current = null;
      return;
    }

    if (initializedUserIdRef.current === userDetails.userId) return;
    initializedUserIdRef.current = userDetails.userId;

    void (async () => {
      await refreshVaults();
      await bootstrapDevice();
      setCaptured(await loadCapturedCredentials());
    })();
  }, [
    bootstrapDevice,
    isAuthenticated,
    refreshVaults,
    setCaptured,
    userDetails?.userId,
  ]);

  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes.captured_credentials) return;
      setCaptured(
        (changes.captured_credentials.newValue as
          | CapturedCredential[]
          | undefined) ?? [],
      );
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [setCaptured]);

  useEffect(() => {
    if (!selectedVaultId) return;
    void refreshPasswords().catch(() => setPasswords([]));
  }, [refreshPasswords, selectedVaultId, setPasswords]);

  useEffect(() => {
    if (!selectedVaultId || !selectedVault?.isOnline) {
      setIsKeySyncModalActive(false);
      setKeySyncVaultId(null);
      return;
    }

    let cancelled = false;

    void isPinPresent(selectedVaultId).catch((error: unknown) => {
      if (cancelled || !(error instanceof KeyNotFoundException)) return;
      setKeySyncVaultId(selectedVaultId);
      setIsKeySyncModalActive(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isPinPresent, selectedVaultId, selectedVault?.isOnline]);

  const runWithVaultKeySync = useCallback(
    async (vaultId: string, action: () => Promise<void>) => {
      try {
        const hasPin = await isPinPresent(vaultId);
        if (!hasPin) {
          setPendingAction(() => action);
          setIsPinModalActive(true);
          return;
        }

        await action();
      } catch (error) {
        if (error instanceof KeyNotFoundException) {
          setPendingAction(() => action);
          setKeySyncVaultId(vaultId);
          setIsKeySyncModalActive(true);
          return;
        }

        throw error;
      }
    },
    [isPinPresent],
  );

  const resumeSave = useCallback(
    async (values: SaveValues, source?: CapturedCredential) => {
      if (!selectedVaultId) return;

      const cipherText = await encrypt(values.password, selectedVaultId);
      const result = await executeSavePasswordRequest({
        identifier: values.identifier,
        domain: normalizeDomain(values.domain),
        cipherText,
        vaultId: selectedVaultId,
      });

      setStatus({ type: "success", message: result.message });
      await refreshVaults();
      await refreshPasswords();

      if (!source) return;

      const next = captured.filter((item) => item.id !== source.id);
      setCaptured(next);
      await saveCapturedCredentials(next);
      await chrome.action.setBadgeText({
        text: next.length > 0 ? String(next.length) : "",
      });
    },
    [
      captured,
      encrypt,
      refreshPasswords,
      refreshVaults,
      selectedVaultId,
      setCaptured,
    ],
  );

  const handleSave = useCallback(
    async (values: SaveValues) => {
      setStatus(null);
      try {
        if (!selectedVaultId || !selectedVault?.isOnline) {
          throw new Error("Select an online vault");
        }

        await runWithVaultKeySync(selectedVaultId, () => resumeSave(values));
        return true;
      } catch (error) {
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "Save failed",
        });
        return false;
      }
    },
    [resumeSave, runWithVaultKeySync, selectedVault, selectedVaultId],
  );

  const handleSaveCaptured = useCallback(
    async (item: CapturedCredential) => {
      setStatus(null);
      try {
        if (!selectedVaultId || !selectedVault?.isOnline) {
          throw new Error("Select an online vault");
        }

        await runWithVaultKeySync(selectedVaultId, () =>
          resumeSave(
            {
              identifier: item.identifier,
              password: item.password,
              domain: item.domain,
            },
            item,
          ),
        );
      } catch (error) {
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "Save failed",
        });
      }
    },
    [resumeSave, runWithVaultKeySync, selectedVault, selectedVaultId],
  );

  const handleReveal = useCallback(
    async (passwordId: string) => {
      setStatus(null);
      try {
        if (!selectedVaultId || !selectedVault?.isOnline) return;

        await runWithVaultKeySync(selectedVaultId, async () => {
          if (!selectedVaultId) return;

          setLoadingCiphertextPhase((prev) => ({
            ...prev,
            [passwordId]: "Fetching",
          }));

          const response = await executePasswordCiphertextRequest(
            passwordId,
            selectedVaultId,
          );

          setLoadingCiphertextPhase((prev) => ({
            ...prev,
            [passwordId]: "Decrypting",
          }));

          const plain = await decrypt(response.ciphertext, selectedVaultId);
          setRevealedPassword(passwordId, plain);
        });
      } catch (error) {
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "Decrypt failed",
        });
      } finally {
        setLoadingCiphertextPhase((prev) => {
          const next = { ...prev };
          delete next[passwordId];
          return next;
        });
      }
    },
    [
      decrypt,
      runWithVaultKeySync,
      selectedVault,
      selectedVaultId,
      setRevealedPassword,
    ],
  );

  const runPendingAction = useCallback(async () => {
    if (!pendingAction) return;

    try {
      await pendingAction();
    } finally {
      setPendingAction(null);
    }
  }, [pendingAction]);

  return {
    isAuthenticated,
    userDetails,
    selectedVaultId,
    selectedVault,
    status,
    isPinModalActive,
    setIsPinModalActive,
    isKeySyncModalActive,
    setIsKeySyncModalActive,
    keySyncVaultId,
    loadingCiphertextPhase,
    setPin,
    handleSave,
    handleSaveCaptured,
    handleReveal,
    runPendingAction,
    setStatus,
  };
}
