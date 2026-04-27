import { useState } from "react";

type SaveValues = { identifier: string; password: string; domain: string };

type Props = {
  onSubmit: (values: SaveValues) => Promise<void>;
};

export default function AddPasswordForm({ onSubmit }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");

  async function handleSubmit() {
    await onSubmit({ identifier, password, domain });
    setIdentifier("");
    setPassword("");
    setDomain("");
  }

  return (
    <section
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <h2 style={{ fontSize: 16 }}>Add Password</h2>
      <input
        placeholder="Identifier"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />
      <input
        placeholder="Domain"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={() => void handleSubmit()}>Encrypt & Save</button>
    </section>
  );
}
