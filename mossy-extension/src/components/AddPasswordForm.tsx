import { useState } from "react";
import type { FormEvent } from "react";
import { usePopupController } from "../hooks/usePopupController";
import { motion } from "framer-motion";
import {
  fadeUp,
  input,
  panel,
  primaryButton,
  section,
  sectionHeader,
  sectionTitle,
  subtitle,
} from "./popupStyles";

function getStrength(password: string) {
  const score = [
    password.length >= 10,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  return Math.min(score, 4);
}

export default function AddPasswordForm() {
  const { selectedVault, handleSave } = usePopupController();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const strength = getStrength(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didSave = await handleSave({ identifier, password, domain });
    if (!didSave) return;

    setIdentifier("");
    setPassword("");
    setDomain("");
  }

  return (
    <motion.form
      className={`${panel} ${section}`}
      onSubmit={(event) => void handleSubmit(event)}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
    >
      <div className={sectionHeader}>
        <h2 className={sectionTitle}>Add password</h2>
        <p className={subtitle}>
          Encrypt and store a new credential.
        </p>
      </div>
      <input
        className={input}
        placeholder="Identifier"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />
      <input
        className={input}
        placeholder="Domain"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
      />
      <input
        className={input}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div
        className="h-1.5 overflow-hidden rounded-full bg-gray-200"
        aria-hidden="true"
      >
        <motion.span
          className={[
            "block h-full rounded-full",
            strength <= 1
              ? "bg-red-500"
              : strength === 2
                ? "bg-orange-500"
                : strength === 3
                  ? "bg-lime-500"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-500",
          ].join(" ")}
          animate={{ width: `${password ? Math.max(strength, 1) * 25 : 0}%` }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </div>
      <button className={primaryButton} disabled={!selectedVault?.isOnline}>
        Encrypt & Save
      </button>
    </motion.form>
  );
}
