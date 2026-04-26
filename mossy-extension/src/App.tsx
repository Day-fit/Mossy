import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthInit } from './hooks/useAuthInit';
import { useAuth } from './hooks/useAuth';
import { executeLoginRequest } from './api/auth.api';
import { useVault } from './hooks/useVault';
import { useDeviceBootstrap } from './hooks/useDeviceBootstrap';
import { useEncryptionHook } from './hooks/useEncryptionHook';
import { executePasswordCiphertextRequest, executePasswordMetadataRequest, executeSavePasswordRequest } from './api/password.api';
import { normalizeDomain } from './utils/domain';
import { loadCapturedCredentials, saveCapturedCredentials } from './utils/chromeStorage';
import type { CapturedCredential, PasswordMetadataDto } from './types';
import { KeyNotFoundException } from './exception/KeyNotFoundException';
import KeySyncModal from './components/KeySyncModal';
import PasswordPinModal from './components/PasswordPinModal';

export default function App() {
  useAuthInit();
  const { isAuthenticated, userDetails, login } = useAuth();
  const { vaults, selectedVaultId, setSelectedVaultId, refreshVaults } = useVault();
  const { bootstrapDevice } = useDeviceBootstrap();
  const { setPin, encrypt, decrypt, isPinPresent } = useEncryptionHook();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [passwords, setPasswords] = useState<PasswordMetadataDto[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [captured, setCaptured] = useState<CapturedCredential[]>([]);
  const [isPinModalActive, setIsPinModalActive] = useState(false);
  const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);
  const [keySyncVaultId, setKeySyncVaultId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const initializedUserIdRef = useRef<string | null>(null);

  const selectedVault = useMemo(() => vaults.find((v) => v.vaultId === selectedVaultId), [vaults, selectedVaultId]);

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
      const capturedCredentials = await loadCapturedCredentials();
      setCaptured(capturedCredentials);
    })();
  }, [bootstrapDevice, isAuthenticated, refreshVaults, userDetails?.userId]);

  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local') return;
      if (!changes.captured_credentials) return;
      setCaptured((changes.captured_credentials.newValue as CapturedCredential[] | undefined) ?? []);
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!selectedVaultId) return;

    void executePasswordMetadataRequest(selectedVaultId)
      .then((result) => {
        setPasswords(result.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()));
      })
      .catch(() => setPasswords([]));
  }, [selectedVaultId]);

  useEffect(() => {
    if (!selectedVaultId || !selectedVault?.isOnline) {
      setIsKeySyncModalActive(false);
      setKeySyncVaultId(null);
      return;
    }

    let cancelled = false;

    void isPinPresent(selectedVaultId).catch((e: unknown) => {
      if (cancelled) return;
      if (!(e instanceof KeyNotFoundException)) return;
      setKeySyncVaultId(selectedVaultId);
      setIsKeySyncModalActive(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isPinPresent, selectedVaultId, selectedVault?.isOnline]);

  async function handleLogin() {
    setError('');
    setStatus('');
    try {
      const response = await executeLoginRequest({ identifier: loginIdentifier, password: loginPassword });
      const data = await response.json();
      if (!data.accessToken) throw new Error('Missing access token');
      login(data.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  async function runWithVaultKeySync(vaultId: string, action: () => Promise<void>) {
    try {
      if (!(await isPinPresent(vaultId))) {
        setPendingAction(() => action);
        setIsPinModalActive(true);
        return;
      }
    } catch (e) {
      if (e instanceof KeyNotFoundException) {
        setPendingAction(() => action);
        setKeySyncVaultId(vaultId);
        setIsKeySyncModalActive(true);
        return;
      }
      throw e;
    }

    await action();
  }

  async function resumeSave(source?: CapturedCredential) {
    if (!selectedVaultId) return;

    const finalIdentifier = source?.identifier ?? identifier;
    const finalPassword = source?.password ?? password;
    const finalDomain = normalizeDomain(source?.domain ?? domain);
    const cipherText = await encrypt(finalPassword, selectedVaultId);
    const result = await executeSavePasswordRequest({
      identifier: finalIdentifier,
      domain: finalDomain,
      cipherText,
      vaultId: selectedVaultId,
    });

    setStatus(result.message);
    setIdentifier('');
    setPassword('');
    setDomain('');
    await refreshVaults();
    const metadata = await executePasswordMetadataRequest(selectedVaultId);
    setPasswords(metadata);

    if (source) {
      const next = captured.filter((item) => item.id !== source.id);
      setCaptured(next);
      await saveCapturedCredentials(next);
      await chrome.action.setBadgeText({ text: next.length > 0 ? String(next.length) : '' });
    }
  }

  async function handleAddPassword(source?: CapturedCredential) {
    setError('');
    setStatus('');

    try {
      if (!selectedVaultId || !selectedVault?.isOnline) {
        throw new Error('Select an online vault');
      }

      await runWithVaultKeySync(selectedVaultId, () => resumeSave(source));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function resumeRevealToggle(passwordId: string) {
    if (!selectedVaultId) return;

    if (revealed[passwordId]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[passwordId];
        return next;
      });
      return;
    }

    const response = await executePasswordCiphertextRequest(passwordId, selectedVaultId);
    const plain = await decrypt(response.ciphertext, selectedVaultId);
    setRevealed((prev) => ({ ...prev, [passwordId]: plain }));
  }

  async function handleReveal(passwordId: string) {
    setError('');

    try {
      if (!selectedVaultId || !selectedVault?.isOnline) return;
      await runWithVaultKeySync(selectedVaultId, () => resumeRevealToggle(passwordId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decrypt failed');
    }
  }

  if (isAuthenticated !== true) {
    return (
      <div className="app">
        <section className="card hero">
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>An open-source password manager that never wants your secrets</h1>
          <p className="small">A self-hosted vault with end-to-end encryption and key synchronization.</p>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ fontSize: 18 }}>Sign in</h2>
          <input placeholder="Email or username" value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} />
          <input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <button onClick={() => void handleLogin()}>Login</button>
          {error ? <p className="status-err">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <section className="card hero">
        <h1 style={{ fontSize: 20 }}>{userDetails?.username ?? 'Mossy'}</h1>
        <p className="small">Select vault, sync key, then save/reveal passwords.</p>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Vault</h2>
        <select value={selectedVaultId} onChange={(e) => setSelectedVaultId(e.target.value)}>
          <option value="">Choose vault</option>
          {vaults.map((vault) => (
            <option key={vault.vaultId} value={vault.vaultId}>
              {vault.vaultName} ({vault.isOnline ? 'online' : 'offline'})
            </option>
          ))}
        </select>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Add Password</h2>
        <input placeholder="Identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <input placeholder="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={() => void handleAddPassword()}>Encrypt & Save</button>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Captured From Websites</h2>
        {captured.length === 0 ? <p className="small">No captured credentials</p> : null}
        {captured.map((item) => (
          <div key={item.id} className="password-item">
            <p style={{ fontSize: 13 }}>
              {item.identifier} @ {item.domain}
            </p>
            <div className="row">
              <button onClick={() => void handleAddPassword(item)}>Save to vault</button>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Stored Passwords</h2>
        {passwords.length === 0 ? <p className="small">No passwords</p> : null}
        {passwords.map((item) => (
          <div key={item.passwordId} className="password-item">
            <p style={{ fontSize: 13 }}>
              {item.identifier} @ {item.domain}
            </p>
            <p className="small">{revealed[item.passwordId] ?? '••••••••••'}</p>
            <button className="secondary" onClick={() => void handleReveal(item.passwordId)}>
              {revealed[item.passwordId] ? 'Hide' : 'Reveal'}
            </button>
          </div>
        ))}
      </section>

      {status ? <p className="status-ok">{status}</p> : null}
      {error ? <p className="status-err">{error}</p> : null}

      {isPinModalActive && selectedVaultId ? (
        <PasswordPinModal
          vaultId={selectedVaultId}
          onClose={() => setIsPinModalActive(false)}
          onPinEntered={async () => {
            setIsPinModalActive(false);
            if (!pendingAction) return;
            try {
              await pendingAction();
            } finally {
              setPendingAction(null);
            }
          }}
        />
      ) : null}

      {isKeySyncModalActive && keySyncVaultId ? (
        <KeySyncModal
          vaultId={keySyncVaultId}
          onClose={() => setIsKeySyncModalActive(false)}
          onSynchronized={() => {
            setStatus('Key synchronized');
            setPendingAction(null);
          }}
        />
      ) : null}
    </div>
  );
}
