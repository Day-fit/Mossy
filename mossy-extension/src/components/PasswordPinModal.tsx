import ReactDOM from "react-dom";
import { Controller, useForm } from "react-hook-form";
import { OTPInput } from "input-otp";

type PasswordPinModalProps = {
  vaultId: string;
  onPinEntered?: (pin: string) => void | Promise<void>;
  onClose: () => void;
};

export default function PasswordPinModal({
  onPinEntered,
  onClose,
}: PasswordPinModalProps) {
  const { handleSubmit, control } = useForm({ defaultValues: { pin: "" } });

  const onSubmit = async ({ pin }: { pin: string }) => {
    if (onPinEntered) await onPinEntered(pin);
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-header">
          <h1 className="modal-title">Enter your vault PIN</h1>
          <p className="section-subtitle">
            This vault is protected by a PIN. Enter it to proceed.
          </p>
        </div>

        <Controller
          name="pin"
          control={control}
          render={({ field }) => (
            <OTPInput
              {...field}
              maxLength={4}
              onChange={(val) => {
                field.onChange(val);
                if (val.length === 4) handleSubmit(onSubmit)();
              }}
              render={({ slots }) => (
                <div className="otp-container">
                  {slots.map((slot, i) => (
                    <div
                      key={i}
                      className={`otp-slot ${slot.isActive ? "active" : ""}`}
                    >
                      {slot.char ?? (
                        <span className="otp-placeholder">•</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            />
          )}
        />

        <div className="row">
          <button type="submit">Continue</button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
