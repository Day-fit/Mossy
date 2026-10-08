import { motion, useReducedMotion } from 'framer-motion';
import Section from '../shared/Section.tsx';

export default function About() {
    const reducedMotion = useReducedMotion();

    return (
        <>
            <Section
                title="Your passwords live on your server."
                variant="sprigs"
                className="border-t border-border bg-surface"
                contentClassName="max-w-5xl text-center"
                titleClassName="text-5xl md:text-6xl leading-[1.1]"
            >
                <p className="text-xl md:text-2xl leading-[1.5] text-fg-muted">
                    Not ours. Not “encrypted with us”. Yours.
                </p>
            </Section>

            <Section title="What this is" variant="canopy">
                <div className="space-y-10 text-lg text-fg-secondary">
                    <p>
                        This is not a traditional secure password manager. It is
                        a deliberate reduction of trust.
                    </p>
                    <p>
                        Mossy exists for one simple reason: passwords should be
                        stored only on infrastructure you control. No cloud
                        custody. No trust promises.
                    </p>
                </div>
            </Section>

            <Section
                title="How it works"
                variant="ferns"
                className="bg-surface-subtle"
                contentClassName="max-w-6xl"
            >
                <div className="grid gap-16 md:grid-cols-2">
                    <div className="space-y-6">
                        <p className="text-lg text-fg-secondary">
                            The backend is intentionally minimal.
                        </p>
                        <ul className="text-lg space-y-4 text-fg-secondary">
                            {[
                                'Data transport',
                                'Key synchronization',
                                'Nothing else',
                            ].map((item, i) => (
                                <motion.li
                                    key={item}
                                    initial={
                                        reducedMotion
                                            ? false
                                            : { opacity: 0, x: -20 }
                                    }
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={
                                        reducedMotion
                                            ? { duration: 0 }
                                            : { delay: 0.2 + i * 0.1 }
                                    }
                                >
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-xl">What this guarantees</h3>
                        <ul className="space-y-4 text-fg-secondary">
                            {[
                                <>
                                    The central service is{' '}
                                    <strong>technically incapable</strong> of
                                    reading secrets
                                </>,
                                'A backend compromise does not expose user vaults',
                                'Full control over storage stays with the user',
                            ].map((item, i) => (
                                <motion.li
                                    key={i}
                                    initial={
                                        reducedMotion
                                            ? false
                                            : { opacity: 0, x: 20 }
                                    }
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={
                                        reducedMotion
                                            ? { duration: 0 }
                                            : { delay: 0.3 + i * 0.1 }
                                    }
                                >
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Section>

            <Section title="Is this for you?" variant="canopy">
                <div className="grid md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-xl mb-4">Probably yes, if you:</h3>
                        <ul className="space-y-3 text-fg-secondary">
                            {[
                                'run your own infrastructure',
                                'want a single trust boundary',
                                'prefer control over convenience',
                            ].map((item, i) => (
                                <motion.li
                                    key={item}
                                    initial={
                                        reducedMotion
                                            ? false
                                            : { opacity: 0, y: 12 }
                                    }
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={
                                        reducedMotion
                                            ? { duration: 0 }
                                            : { delay: 0.2 + i * 0.1 }
                                    }
                                >
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xl mb-4">Probably not, if you:</h3>
                        <ul className="space-y-3 text-fg-secondary">
                            {[
                                'don’t want to self-host',
                                'are looking for a managed service',
                            ].map((item, i) => (
                                <motion.li
                                    key={item}
                                    initial={
                                        reducedMotion
                                            ? false
                                            : { opacity: 0, y: 12 }
                                    }
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={
                                        reducedMotion
                                            ? { duration: 0 }
                                            : { delay: 0.2 + i * 0.1 }
                                    }
                                >
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Section>
        </>
    );
}
