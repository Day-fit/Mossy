import { usePopupController } from "../hooks/usePopupController";
import { motion } from "framer-motion";
import { eyebrow, fadeUp, heroTitle, subtitle } from "./popupStyles";

export default function PopupHero() {
  const { userDetails, selectedVault } = usePopupController();

  return (
    <motion.section
      className="relative flex min-h-32 justify-between gap-3 overflow-hidden rounded-lg bg-white bg-cover bg-bottom bg-no-repeat p-4 shadow-sm"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(255,255,255,0.94), rgba(255,255,255,0.72)), url('/hero.png')",
      }}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
    >
      <div className="relative z-10">
        <p className={eyebrow}>Mossy extension</p>
        <h1 className={heroTitle}>{userDetails?.username ?? "Mossy"}</h1>
        <p className={subtitle}>Save and fill from your vault.</p>
      </div>
      <span
        className={[
          "relative z-10 inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold",
          selectedVault?.isOnline
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700",
        ].join(" ")}
      >
        {selectedVault?.isOnline ? "Online" : "Offline"}
      </span>
    </motion.section>
  );
}
