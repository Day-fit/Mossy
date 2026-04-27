import { useCapturedStore } from "../store/capturedStore";
import type { CapturedCredential } from "../types";

type Props = {
  onSave: (item: CapturedCredential) => Promise<void>;
};

export default function CapturedCredentialsList({ onSave }: Props) {
  const { captured } = useCapturedStore();

  return (
    <section
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <h2 style={{ fontSize: 16 }}>Captured From Websites</h2>
      {captured.length === 0 ? (
        <p className="small">No captured credentials</p>
      ) : null}
      {captured.map((item) => (
        <div key={item.id} className="password-item">
          <p style={{ fontSize: 13 }}>
            {item.identifier} @ {item.domain}
          </p>
          <div className="row">
            <button onClick={() => void onSave(item)}>Save to vault</button>
          </div>
        </div>
      ))}
    </section>
  );
}
