import ReactDOM from "react-dom";
import { Controller, useForm } from "react-hook-form";
import { OTPInput } from "input-otp";
import { motion, stagger, type Variants } from "framer-motion";

type PasswordPinModalProps = {
  vaultId: string;
  onPinEntered?: (pin: string) => void | Promise<void>;
  onClose: () => void;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
      delayChildren: stagger(0.07),
    },
  },
};

const childVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.form
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white shadow-md rounded-xl w-80 flex flex-col p-6 gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Enter your vault PIN
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            This vault is protected by a PIN. Enter it to proceed.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          <Controller
            name="pin"
            control={control}
            render={({ field }) => (
              <OTPInput
                {...field}
                maxLength={4}
                containerClassName="flex gap-2"
                onChange={(val) => {
                  field.onChange(val);
                  if (val.length === 4) handleSubmit(onSubmit)();
                }}
                render={({ slots }) => (
                  <motion.div
                    className="flex gap-3"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {slots.map((slot, i) => (
                      <motion.div
                        key={i}
                        variants={childVariants}
                        className={`
                          w-12 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-semibold
                          transition-colors duration-150
                          ${
                            slot.isActive
                              ? "border-[#007735] bg-green-50 shadow-sm shadow-green-100"
                              : "border-gray-200 bg-white text-gray-800"
                          }
                        `}
                      >
                        {slot.char ?? (
                          <span className="text-gray-300 text-base">–</span>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              />
            )}
          />
        </div>

        <div className="flex justify-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
