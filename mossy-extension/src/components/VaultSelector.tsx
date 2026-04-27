import { useVaultStore } from "../store/vaultStore";
import {
  loadSelectedVaultId,
  saveSelectedVaultId,
} from "../utils/chromeStorage.ts";
import { useEffect } from "react";

export default function VaultSelector() {
  const { vaults, selectedVaultId, setSelectedVaultId } = useVaultStore();

  useEffect(() => {
    if (!vaults.length) return;

    void (async () => {
      const savedId = await loadSelectedVaultId();
      if (savedId && vaults.some((v) => v.vaultId === savedId)) {
        setSelectedVaultId(savedId);
      }
    })();
  }, [vaults, setSelectedVaultId]);

  async function handleChange(vaultId: string) {
    setSelectedVaultId(vaultId);
    await saveSelectedVaultId(vaultId || null);
  }

  return (
    <section
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <h2 style={{ fontSize: 16 }}>Vault</h2>
      <select
        value={selectedVaultId}
        onChange={(e) => void handleChange(e.target.value)}
      >
        <option value="">Choose vault</option>
        {vaults.map((vault) => (
          <option key={vault.vaultId} value={vault.vaultId}>
            {vault.vaultName} ({vault.isOnline ? "online" : "offline"})
          </option>
        ))}
      </select>
    </section>
  );
}
