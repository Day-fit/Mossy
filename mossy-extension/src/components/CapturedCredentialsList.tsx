import { useCapturedStore } from "../store/capturedStore";
import type { CapturedCredential } from "../types";

type Props = {
  onSave: (item: CapturedCredential) => Promise<void>;
};

export default function CapturedCredentialsList({ onSave }: Props) {
  const { captured } = useCapturedStore();

  return (
    <section className="card section">
      <div className="section-header">
        <h2 className="section-title">Captured from websites</h2>
        <p className="section-subtitle">
          Review autofilled credentials before saving.
        </p>
      </div>
      {captured.length === 0 ? (
        <p className="empty-state">No captured credentials yet.</p>
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
