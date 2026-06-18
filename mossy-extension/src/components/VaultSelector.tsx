import { useVaultStore } from "../store/vaultStore";
import {
  loadSelectedVaultId,
  saveSelectedVaultId,
} from "../utils/chromeStorage.ts";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  countPill,
  emptyState,
  fadeUp,
  panel,
  panelTitleRow,
  section,
  sectionHeader,
  sectionTitle,
  subtitle,
} from "./popupStyles";

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
    <motion.section
      className={`${panel} ${section}`}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
    >
      <div className={panelTitleRow}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>Vaults</h2>
          <p className={subtitle}>Choose where extension actions run.</p>
        </div>
        <span className={countPill}>{vaults.length} total</span>
      </div>

      {vaults.length === 0 ? (
        <p className={emptyState}>No vaults available.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {vaults.map((vault) => {
            const isSelected = vault.vaultId === selectedVaultId;

            return (
              <motion.button
                key={vault.vaultId}
                type="button"
                className={[
                  "flex min-h-24 flex-col items-start gap-1 rounded-lg border p-3 text-left transition active:scale-[0.99]",
                  isSelected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : vault.isOnline
                      ? "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:shadow-sm"
                      : "border-red-100 bg-red-50 text-red-700 hover:border-red-200",
                ]
                  .filter(Boolean)
                  .join(" ")}
                whileHover={{ y: -1 }}
                transition={{ duration: 0.14 }}
                onClick={() => void handleChange(vault.vaultId)}
              >
                <span className="text-[13px] font-semibold leading-snug [overflow-wrap:anywhere]">
                  {vault.vaultName}
                </span>
                <span
                  className={[
                    "text-[11px]",
                    isSelected ? "text-white/75" : "text-gray-500",
                  ].join(" ")}
                >
                  {vault.passwordCount} passwords
                </span>
                <span
                  className={[
                    "mt-auto flex items-center gap-1.5 text-[11px]",
                    isSelected ? "text-white/80" : "text-gray-500",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "block h-2 w-2 rounded-full",
                      vault.isOnline ? "bg-emerald-500" : "bg-red-400",
                    ].join(" ")}
                  />
                  {vault.isOnline ? "Online" : "Offline"}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
