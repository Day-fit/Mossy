import AddPasswordForm from "./AddPasswordForm";
import CapturedCredentialsList from "./CapturedCredentialsList";
import LoginView from "./LoginView";
import PopupHero from "./PopupHero";
import PopupModals from "./PopupModals";
import StatusBanner from "./StatusBanner";
import StoredPasswordsList from "./StoredPasswordsList";
import VaultSelector from "./VaultSelector";
import { usePopupController } from "../hooks/usePopupController";
import { motion } from "framer-motion";

export default function PopupContent() {
  const { isAuthenticated } = usePopupController();

  if (isAuthenticated !== true) {
    return (
      <motion.div
        className="flex max-h-180 flex-col gap-3.5 overflow-y-auto p-3.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
      >
        <LoginView />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex max-h-180 flex-col gap-3.5 overflow-y-auto p-3.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
    >
      <PopupHero />
      <VaultSelector />
      <AddPasswordForm />
      <CapturedCredentialsList />
      <StoredPasswordsList />
      <StatusBanner />
      <PopupModals />
    </motion.div>
  );
}
