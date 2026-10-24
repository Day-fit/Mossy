import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function ViewTransition({
    viewKey,
    children,
    className = '',
}: {
    viewKey: string;
    children: ReactNode;
    className?: string;
}) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            key={viewKey}
            className={`view-transition ${className}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: reduce ? 0 : 0.22,
                ease: [0.22, 1, 0.36, 1],
            }}
        >
            {children}
        </motion.div>
    );
}
