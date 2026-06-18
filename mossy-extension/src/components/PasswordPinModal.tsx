import ReactDOM from "react-dom";
import { Controller, useForm } from "react-hook-form";
import { OTPInput } from "input-otp";
import { motion } from "framer-motion";
import {
  primaryButton,
  secondaryButton,
  sectionHeader,
  subtitle,
} from "./popupStyles";

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
    <motion.div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full max-w-[360px] flex-col gap-4 rounded-lg bg-white p-5 shadow-xl"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={sectionHeader}>
          <h1 className="text-[22px] font-semibold leading-tight text-gray-900">
            Enter your vault PIN
          </h1>
          <p className={subtitle}>
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
                <div className="flex justify-center gap-2.5">
                  {slots.map((slot, i) => (
                    <div
                      key={i}
                      className={[
                        "flex h-[52px] w-[52px] items-center justify-center rounded-lg border-2 text-[22px] font-semibold transition",
                        slot.isActive
                          ? "border-[#007735] bg-emerald-50 shadow-sm shadow-emerald-100"
                          : "border-gray-200 bg-white text-gray-900",
                      ].join(" ")}
                    >
                      {slot.char ?? (
                        <span className="text-lg text-gray-300">•</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            />
          )}
        />

        <div className="flex gap-2">
          <button className={primaryButton} type="submit">
            Continue
          </button>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
