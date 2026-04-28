import { usePasswordsStore } from "../store/passwordsStore";
import { useRevealedStore } from "../store/revealedStore";

type Props = {
  onReveal: (passwordId: string) => Promise<void>;
};

export default function StoredPasswordsList({ onReveal }: Props) {
  const { passwords } = usePasswordsStore();
  const { revealed, hidePassword } = useRevealedStore();

  async function handleToggle(passwordId: string) {
    if (revealed[passwordId]) {
      hidePassword(passwordId);
      return;
    }
    await onReveal(passwordId);
  }

  return (
    <section className="card section">
      <div className="section-header">
        <h2 className="section-title">Stored passwords</h2>
        <p className="section-subtitle">
          Reveal or hide encrypted passwords on demand.
        </p>
      </div>
      {passwords.length === 0 ? (
        <p className="empty-state">No passwords saved yet.</p>
      ) : null}
      {passwords.map((item) => (
        <div key={item.passwordId} className="password-item">
          <p style={{ fontSize: 13 }}>
            {item.identifier} @ {item.domain}
          </p>
          <p className="small">{revealed[item.passwordId] ?? "••••••••••"}</p>
          <button
            className="secondary"
            onClick={() => void handleToggle(item.passwordId)}
          >
            {revealed[item.passwordId] ? "Hide" : "Reveal"}
          </button>
        </div>
      ))}
    </section>
  );
}
