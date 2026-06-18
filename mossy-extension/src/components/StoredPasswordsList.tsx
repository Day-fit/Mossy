import { usePasswordsStore } from "../store/passwordsStore";
import { useRevealedStore } from "../store/revealedStore";
import { usePopupController } from "../hooks/usePopupController";
import { motion } from "framer-motion";
import {
  compactSecondaryButton,
  countPill,
  emptyState,
  fadeUp,
  itemMeta,
  itemSubtitle,
  itemTitle,
  panel,
  panelTitleRow,
  section,
  sectionHeader,
  sectionTitle,
  subtitle,
} from "./popupStyles";

export default function StoredPasswordsList() {
  const { passwords } = usePasswordsStore();
  const { revealed, hidePassword } = useRevealedStore();
  const { loadingCiphertextPhase, handleReveal } = usePopupController();

  async function handleToggle(passwordId: string) {
    if (revealed[passwordId]) {
      hidePassword(passwordId);
      return;
    }
    await handleReveal(passwordId);
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
          <h2 className={sectionTitle}>Passwords</h2>
          <p className={subtitle}>Reveal encrypted values on demand.</p>
        </div>
        <span className={countPill}>{passwords.length} saved</span>
      </div>
      {passwords.length === 0 ? (
        <p className={emptyState}>No passwords saved yet.</p>
      ) : null}
      {passwords.map((item) => (
        <motion.article
          key={item.passwordId}
          className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="flex justify-between">
            <div className="min-w-0">
              <p className={itemTitle}>{item.identifier}</p>
              <p className={itemSubtitle}>{item.domain}</p>
              <p className={itemMeta}>
                Updated {new Date(item.lastModified).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 p-2">
            <p className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-gray-700">
              {revealed[item.passwordId] ?? "••••••••••••"}
            </p>
            <button
              className={compactSecondaryButton}
              disabled={loadingCiphertextPhase[item.passwordId] !== undefined}
              onClick={() => void handleToggle(item.passwordId)}
            >
              {loadingCiphertextPhase[item.passwordId]
                ? `${loadingCiphertextPhase[item.passwordId]}...`
                : revealed[item.passwordId]
                  ? "Hide"
                  : "Reveal"}
            </button>
          </div>
        </motion.article>
      ))}
    </motion.section>
  );
}
