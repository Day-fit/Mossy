import { motion } from 'framer-motion';

export const authCardClass =
    'bg-surface shadow-modal rounded-2xl py-10 px-6 sm:px-10 lg:px-20 space-y-7 w-full md:w-1/2 max-w-xl my-5';
export const authInputClass =
    'w-full rounded-lg border-2 border-border bg-surface px-4 py-3 placeholder:text-fg-subtle focus:border-brand focus:outline-none';
export const authButtonClass =
    'w-full disabled:bg-fg-disabled shadow-control disabled:cursor-not-allowed';

export function AuthBusyLabel({ children }: { children: string }) {
    return (
        <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        >
            {children}
        </motion.span>
    );
}
