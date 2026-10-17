import { useId, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SectionLeaves, { type SectionLeafVariant } from './SectionLeaves.tsx';

type SectionProps = {
    title: ReactNode;
    children: ReactNode;
    variant?: SectionLeafVariant;
    className?: string;
    contentClassName?: string;
    titleClassName?: string;
};

export default function Section({
    title,
    children,
    variant = 'sprigs',
    className = '',
    contentClassName = 'max-w-4xl',
    titleClassName = 'text-3xl',
}: SectionProps) {
    const titleId = useId();
    const reducedMotion = useReducedMotion();

    return (
        <section
            aria-labelledby={titleId}
            className={`relative isolate px-6 py-28 ${className}`}
        >
            <SectionLeaves variant={variant} />
            <motion.div
                className={`relative z-10 mx-auto ${contentClassName}`}
                initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: reducedMotion ? 0 : 0.6 }}
            >
                <h2 id={titleId} className={`mb-8 ${titleClassName}`}>
                    {title}
                </h2>
                {children}
            </motion.div>
        </section>
    );
}
