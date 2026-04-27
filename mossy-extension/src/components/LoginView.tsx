import { useState } from "react";
import {
  executeLoginRequest,
  executeUserDetailsRequest,
} from "../api/auth.api";
import { useAuthStore } from "../store/authStore";
import { tokenStorage } from "../auth/tokenStorage.ts";

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
      <section className="card hero section">
        <div className="section-header">
          <h1 className="hero-title">
            An open-source password manager that never wants your secrets
          </h1>
          <p className="section-subtitle">
            A self-hosted vault with end-to-end encryption and key
            synchronization.
          </p>
        </div>
      </section>

      <section className="card section">
        <div className="section-header">
          <h2 className="section-title">Sign in</h2>
          <p className="section-subtitle">Access your vaults securely.</p>
        </div>
        <input
          placeholder="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => void handleLogin()}>Login</button>
        {error ? <p className="status-err">{error}</p> : null}
      </section>
    </>
  );
}
