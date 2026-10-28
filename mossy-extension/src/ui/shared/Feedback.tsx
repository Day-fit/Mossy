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
    size = 'default',
    id,
    className = '',
    onDismiss,
}: {
    children: ReactNode;
    tone?: 'error' | 'success' | 'info';
    size?: 'default' | 'large';
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
    const toneClassName = {
        error: 'border-[color-mix(in_srgb,var(--color-fg-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-fg-danger)_5%,var(--color-surface))] text-fg-danger',
        success:
            'border-[color-mix(in_srgb,var(--color-fg-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-fg-success)_5%,var(--color-surface))] text-fg-success',
        info: 'border-border bg-surface-subtle text-fg-secondary',
    }[tone];
    return (
        <motion.div
            id={id}
            role={tone === 'error' ? 'alert' : 'status'}
            className={`flex gap-2.5 rounded-lg border text-[0.8125rem] leading-[1.65] [overflow-wrap:anywhere] ${size === 'large' ? 'items-center p-[18px]' : 'items-start p-3'} ${toneClassName} ${className}`}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
        >
            <Icon
                className="mt-0.5 shrink-0"
                size={size === 'large' ? 30 : 19}
                aria-hidden="true"
            />
            <span className="min-w-0 flex-1">{children}</span>
            {onDismiss && (
                <button
                    className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[19px] text-inherit motion-safe:enabled:active:scale-[0.98]"
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
