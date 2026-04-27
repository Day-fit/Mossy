import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthInit } from "./hooks/useAuthInit";
import { useAuthStore } from "./store/authStore";
import { useVaultStore } from "./store/vaultStore";
import { useEncryptionStore } from "./store/encryptionStore";
import { useCapturedStore } from "./store/capturedStore";
import { usePasswordsStore } from "./store/passwordsStore";
import { useRevealedStore } from "./store/revealedStore";
import { useDeviceBootstrap } from "./hooks/useDeviceBootstrap";
import { useEncryptionHook } from "./hooks/useEncryptionHook";
import {
  executePasswordCiphertextRequest,
  executePasswordMetadataRequest,
  executeSavePasswordRequest,
} from "./api/password.api";
import { normalizeDomain } from "./utils/domain";
import {
  loadCapturedCredentials,
  saveCapturedCredentials,
} from "./utils/chromeStorage";
import type { CapturedCredential } from "./types";
import { KeyNotFoundException } from "./exception/KeyNotFoundException";
import KeySyncModal from "./components/KeySyncModal";
import PasswordPinModal from "./components/PasswordPinModal";
import LoginView from "./components/LoginView";
import VaultSelector from "./components/VaultSelector";
import AddPasswordForm from "./components/AddPasswordForm";
import CapturedCredentialsList from "./components/CapturedCredentialsList";
import StoredPasswordsList from "./components/StoredPasswordsList";
import { executeUserVaultsRequest } from "./api/vault.api.ts";

type SaveValues = { identifier: string; password: string; domain: string };

export default function App() {
  useAuthInit();

  const { isAuthenticated, userDetails } = useAuthStore();
  const { vaults, selectedVaultId, setVaults } = useVaultStore();
  const { setPin } = useEncryptionStore();
  const { setCaptured } = useCapturedStore();
  const { setPasswords } = usePasswordsStore();

  const { bootstrapDevice } = useDeviceBootstrap();
  const { encrypt, decrypt, isPinPresent } = useEncryptionHook();

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPinModalActive, setIsPinModalActive] = useState(false);
  const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);
  const [keySyncVaultId, setKeySyncVaultId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const initializedUserIdRef = useRef<string | null>(null);

  const selectedVault = useMemo(
    () => vaults.find((v) => v.vaultId === selectedVaultId),
    [vaults, selectedVaultId],
  );

  async function refreshVaults() {
    const result = await executeUserVaultsRequest();
    setVaults(result);
  }

  async function refreshPasswords() {
    const { selectedVaultId: id } = useVaultStore.getState();
    if (!id) return;
    const metadata = await executePasswordMetadataRequest(id);
    setPasswords(
      metadata.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime(),
      ),
    );
  }

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
    userDetails?.userId,
    refreshVaults,
    setCaptured,
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
  }, []);

  useEffect(() => {
    if (!selectedVaultId) return;
    void refreshPasswords().catch(() => setPasswords([]));
  }, [selectedVaultId]);

  useEffect(() => {
    if (!selectedVaultId || !selectedVault?.isOnline) {
      setIsKeySyncModalActive(false);
      setKeySyncVaultId(null);
      return;
    }

    let cancelled = false;

    void isPinPresent(selectedVaultId).catch((e: unknown) => {
      if (cancelled || !(e instanceof KeyNotFoundException)) return;
      setKeySyncVaultId(selectedVaultId);
      setIsKeySyncModalActive(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isPinPresent, selectedVaultId, selectedVault?.isOnline]);

  async function runWithVaultKeySync(
    vaultId: string,
    action: () => Promise<void>,
  ) {
    try {
      const hasPin = await isPinPresent(vaultId);
      if (!hasPin) {
        setPendingAction(() => action);
        setIsPinModalActive(true);
        return;
      }
      await action();
    } catch (e) {
      if (e instanceof KeyNotFoundException) {
        setPendingAction(() => action);
        setKeySyncVaultId(vaultId);
        setIsKeySyncModalActive(true);
        return;
      }
      throw e;
    }
  }

  async function resumeSave(values: SaveValues, source?: CapturedCredential) {
    const { selectedVaultId: id } = useVaultStore.getState();
    if (!id) return;

    const cipherText = await encrypt(values.password, id);
    const result = await executeSavePasswordRequest({
      identifier: values.identifier,
      domain: normalizeDomain(values.domain),
      cipherText,
      vaultId: id,
    });

    setStatus(result.message);
    await refreshVaults();
    await refreshPasswords();

    if (source) {
      const { captured } = useCapturedStore.getState();
      const next = captured.filter((item) => item.id !== source.id);
      setCaptured(next);
      await saveCapturedCredentials(next);
      await chrome.action.setBadgeText({
        text: next.length > 0 ? String(next.length) : "",
      });
    }
  }

  async function handleSave(values: SaveValues) {
    setError("");
    setStatus("");
    try {
      if (!selectedVaultId || !selectedVault?.isOnline)
        throw new Error("Select an online vault");
      await runWithVaultKeySync(selectedVaultId, () => resumeSave(values));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleSaveCaptured(item: CapturedCredential) {
    setError("");
    setStatus("");
    try {
      if (!selectedVaultId || !selectedVault?.isOnline)
        throw new Error("Select an online vault");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleReveal(passwordId: string) {
    setError("");
    try {
      if (!selectedVaultId || !selectedVault?.isOnline) return;
      await runWithVaultKeySync(selectedVaultId, async () => {
        const { selectedVaultId: id } = useVaultStore.getState();
        if (!id) return;
        const response = await executePasswordCiphertextRequest(passwordId, id);
        const plain = await decrypt(response.ciphertext, id);
        useRevealedStore.getState().setRevealedPassword(passwordId, plain);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decrypt failed");
    }
  }

  async function runPendingAction() {
    if (!pendingAction) return;
    try {
      await pendingAction();
    } finally {
      setPendingAction(null);
    }
  }

  if (isAuthenticated !== true) {
    return (
      <div className="app">
        <LoginView />
      </div>
    );
  }

  return (
    <div className="app">
      <section className="card hero">
        <h1 style={{ fontSize: 20 }}>{userDetails?.username ?? "Mossy"}</h1>
        <p className="small">
          Select vault, sync key, then save/reveal passwords.
        </p>
      </section>

      <VaultSelector />
      <AddPasswordForm onSubmit={handleSave} />
      <CapturedCredentialsList onSave={handleSaveCaptured} />
      <StoredPasswordsList onReveal={handleReveal} />

      {status ? <p className="status-ok">{status}</p> : null}
      {error ? <p className="status-err">{error}</p> : null}

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
            setStatus("Key synchronized");
            await runPendingAction();
          }}
        />
      ) : null}
    </div>
  );
}
