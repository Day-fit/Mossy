import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MdExpandMore, MdInfoOutline } from 'react-icons/md';
import Button from '../shared/Button.tsx';

export default function KeySyncCodeGuide() {
    const [isOpen, setIsOpen] = useState(false);
    const contentId = useId();
    const reduceMotion = useReducedMotion();

    return (
        <div className="w-full max-w-sm rounded-md border border-border bg-surface text-left">
            <Button
                type="button"
                variant="ghost"
                padding="none"
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-fg-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <MdInfoOutline
                    className="shrink-0 text-brand"
                    size={18}
                    aria-hidden="true"
                />
                Where do I find the code?
                <motion.span
                    className="ml-auto inline-flex shrink-0"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                    <MdExpandMore size={20} aria-hidden="true" />
                </motion.span>
            </Button>

            <div id={contentId} aria-hidden={!isOpen}>
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            key="guide-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                                duration: reduceMotion ? 0 : 0.24,
                                ease: 'easeInOut',
                            }}
                            className="overflow-hidden"
                        >
                            <div className="space-y-4 border-t border-border p-4">
                                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-fg-secondary">
                                    <li>
                                        On the device that needs the key, open{' '}
                                        <strong>Passwords</strong> and select
                                        the online vault.
                                    </li>
                                    <li>
                                        Try to add or reveal a password, then
                                        create a PIN when prompted.
                                    </li>
                                    <li>
                                        Keep the sync dialog open. Enter its
                                        6-digit code here on the device that
                                        already has the key.
                                    </li>
                                </ol>

                                <figure className="space-y-2">
                                    <img
                                        src="/key-sync-code-example.png"
                                        alt="The receiving dialog shows the 6-digit sync code below the QR-code instructions."
                                        className="w-full rounded-md border border-border"
                                        width={330}
                                        height={123}
                                        loading="lazy"
                                    />
                                    <figcaption className="text-xs leading-relaxed text-fg-muted">
                                        Example code. Use the code shown on your
                                        receiving device.
                                    </figcaption>
                                </figure>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
