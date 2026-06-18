import { usePopupController } from "../hooks/usePopupController";
import { AnimatePresence, motion } from "framer-motion";
import { statusError, statusSuccess } from "./popupStyles";

export default function StatusBanner() {
  const { status } = usePopupController();

  return (
    <AnimatePresence>
      {status ? (
        <motion.p
          className={status.type === "success" ? statusSuccess : statusError}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {status.message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
