import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
    MdCheckCircleOutline,
    MdClose,
    MdErrorOutline,
    MdInfoOutline,
} from 'react-icons/md';

export default function Feedback({
    children,
    tone = 'error',
    id,
    className = '',
    onDismiss,
}: {
    children: ReactNode;
    tone?: 'error' | 'success' | 'info';
    id?: string;
    className?: string;
    onDismiss?: () => void;
}) {
    const reduce = useReducedMotion();
    const Icon =
        tone === 'success'
            ? MdCheckCircleOutline
            : tone === 'info'
              ? MdInfoOutline
              : MdErrorOutline;
    return (
        <motion.div
            id={id}
            role={tone === 'error' ? 'alert' : 'status'}
            className={`status ${tone} ${className}`}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
        >
            <Icon size={19} aria-hidden="true" />
            <span>{children}</span>
            {onDismiss && (
                <button
                    className="icon"
                    type="button"
                    aria-label="Dismiss error"
                    onClick={onDismiss}
                >
                    <MdClose aria-hidden="true" />
                </button>
            )}
        </motion.div>
    );
}
