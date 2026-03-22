import {motion} from "framer-motion";
import type {ReactNode} from "react";
import RippleButton from "../layout/RippleButton.tsx";

type VaultActionModalProps = {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onClose: () => void;
    confirmDisabled?: boolean;
    children?: ReactNode;
};

export default function VaultActionModal({
    title,
    description,
    confirmLabel,
    onConfirm,
    onClose,
    confirmDisabled = false,
    children
}: VaultActionModalProps) {
    return (
        <motion.section
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <motion.div
                className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
                initial={{scale: 0.95, y: 12}}
                animate={{scale: 1, y: 0}}
            >
                <h3 className="mb-2 text-2xl font-semibold text-gray-900">{title}</h3>
                <p className="mb-5 text-sm text-gray-600">{description}</p>
                {children}

                <div className="mt-6 flex justify-end gap-2">
                    <RippleButton
                        type="button"
                        variant="outline"
                        rippleColor="rgb(0, 0, 0, 0.7)"
                        className="px-6 py-2 text-sm"
                        onClick={onClose}
                    >
                        Cancel
                    </RippleButton>
                    <RippleButton
                        type="button"
                        className="px-6 py-2 text-sm text-white"
                        disabled={confirmDisabled}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </RippleButton>
                </div>
            </motion.div>
        </motion.section>
    );
}
