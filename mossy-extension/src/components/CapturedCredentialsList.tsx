import { useCapturedStore } from "../store/capturedStore";
import { usePopupController } from "../hooks/usePopupController";
import { AnimatePresence, motion } from "framer-motion";
import { MdWarningAmber } from "react-icons/md";
import {
  compactButton,
  countPill,
  emptyState,
  fadeUp,
  itemMeta,
  itemSubtitle,
  itemTitle,
  listItem,
  panel,
  panelTitleRow,
  section,
  sectionHeader,
  sectionTitle,
  subtitle,
} from "./popupStyles";

export default function CapturedCredentialsList() {
  const { captured } = useCapturedStore();
  const { selectedVault, handleSaveCaptured } = usePopupController();
  const canSaveCaptured = selectedVault?.isOnline === true;

  return (
    <motion.section
      className={`${panel} ${section}`}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
    >
      <div className={panelTitleRow}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>Captured</h2>
          <p className={subtitle}>Review credentials found on pages.</p>
        </div>
        <span className={countPill}>{captured.length} new</span>
      </div>
      {captured.length === 0 ? (
        <p className={emptyState}>No captured credentials yet.</p>
      ) : null}
      {captured.length > 0 ? (
        <div className="relative">
          <div
            className={[
              "flex flex-col gap-3 transition",
              canSaveCaptured
                ? ""
                : "max-h-32 overflow-hidden pointer-events-none grayscale opacity-35",
            ].join(" ")}
          >
            <AnimatePresence initial={false}>
              {captured.map((item) => (
                <motion.article
                  key={item.id}
                  className={listItem}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <div className="min-w-0">
                    <p className={itemTitle}>
                      {item.identifier || "Unknown login"}
                    </p>
                    <p className={itemSubtitle}>{item.domain}</p>
                    <p className={itemMeta}>
                      Captured {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className={compactButton}
                    disabled={!canSaveCaptured}
                    title={
                      canSaveCaptured
                        ? "Save to vault"
                        : "Select an online vault to save"
                    }
                    onClick={() => {
                      if (!canSaveCaptured) return;
                      void handleSaveCaptured(item);
                    }}
                  >
                    Save
                  </button>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          {!canSaveCaptured ? (
            <motion.div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/75 px-5 text-center backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex max-w-60 flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-4 py-3 text-xs font-semibold text-gray-700 shadow-sm">
                <MdWarningAmber
                  className="text-3xl text-gray-500"
                  aria-hidden
                />
                <span>Please select an online vault</span>
              </div>
            </motion.div>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  );
}
