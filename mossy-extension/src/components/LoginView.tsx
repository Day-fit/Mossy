import { useState } from "react";
import {
  executeLoginRequest,
  executeUserDetailsRequest,
} from "../api/auth.api";
import { useAuthStore } from "../store/authStore";
import { tokenStorage } from "../auth/tokenStorage.ts";
import { motion } from "framer-motion";
import {
  fadeUp,
  heroTitle,
  input,
  panel,
  primaryButton,
  section,
  sectionHeader,
  sectionTitle,
  statusError,
  subtitle,
} from "./popupStyles";

export default function LoginView() {
  const { setIsAuthenticated, setUserDetails } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    try {
      const response = await executeLoginRequest({ identifier, password });
      const data = await response.json();
      if (!data.accessToken) throw new Error("Missing access token");

      await tokenStorage.set(data.accessToken);

      const detailsResponse = await executeUserDetailsRequest();
      setUserDetails(detailsResponse);
      setIsAuthenticated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }

  return (
    <>
      <motion.section
        className="relative flex min-h-40 overflow-hidden rounded-lg bg-white bg-cover bg-bottom bg-no-repeat p-4 shadow-sm"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,255,255,0.94), rgba(255,255,255,0.72)), url('/hero.png')",
        }}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className="max-w-[310px]">
          <p className="text-[11px] font-bold uppercase text-gray-500">
            Mossy
          </p>
          <h1 className={heroTitle}>
            Passwords stay in your vault
          </h1>
          <p className={subtitle}>
            Sign in to save captured credentials and fill trusted pages.
          </p>
        </div>
      </motion.section>

      <motion.section
        className={`${panel} ${section}`}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>Sign in</h2>
          <p className={subtitle}>Access your vaults securely.</p>
        </div>
        <input
          className={input}
          placeholder="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <input
          className={input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className={primaryButton} onClick={() => void handleLogin()}>
          Login
        </button>
        {error ? <p className={statusError}>{error}</p> : null}
      </motion.section>
    </>
  );
}
