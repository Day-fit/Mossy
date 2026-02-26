import { motion } from "framer-motion";

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
};

export default function About() {
    return (
        <>
            <section className="border-t border-gray-200 py-28 px-6">
                <motion.div
                    className="max-w-5xl mx-auto text-center space-y-6"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    variants={fadeUp}
                >
                    <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900">
                        Your passwords live on your server.
                    </h2>
                    <p className="text-xl md:text-2xl text-gray-600">
                        Not ours. Not “encrypted with us”. Yours.
                    </p>
                </motion.div>
            </section>

            <section className="py-28 px-6">
                <motion.div
                    className="max-w-4xl mx-auto space-y-10"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    variants={fadeUp}
                >
                    <h3 className="text-3xl font-semibold text-gray-900">
                        What this is
                    </h3>

                    <p className="text-lg text-gray-700 leading-relaxed">
                        This is not a traditional secure password manager.
                        It is a deliberate reduction of trust.
                    </p>

                    <p className="text-lg text-gray-700 leading-relaxed">
                        Mossy exists for one simple reason: passwords should be stored only on
                        infrastructure you control. No cloud custody. No trust promises.
                    </p>
                </motion.div>
            </section>

            <section className="py-28 px-6 bg-gray-50">
                <motion.div
                    className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    variants={fadeUp}
                >
                    <div className="space-y-6">
                        <h3 className="text-3xl font-semibold text-gray-900">
                            How it works
                        </h3>

                        <p className="text-lg text-gray-700">
                            The backend is intentionally minimal.
                        </p>

                        <ul className="space-y-4 text-lg text-gray-700">
                            {["Data transport", "Key synchronization", "Nothing else"].map(
                                (item, i) => (
                                    <motion.li
                                        key={item}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.2 + i * 0.1 }}
                                    >
                                        {item}
                                    </motion.li>
                                )
                            )}
                        </ul>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-xl font-semibold text-gray-900">
                            What this guarantees
                        </h4>

                        <ul className="space-y-4 text-gray-700">
                            {[
                                <>The central service is <strong>technically incapable</strong> of reading secrets</>,
                                "A backend compromise does not expose user vaults",
                                "Full control over storage stays with the user",
                            ].map((item, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.3 + i * 0.1 }}
                                >
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                    </div>
                </motion.div>
            </section>

            <section className="py-28 px-6">
                <motion.div
                    className="max-w-4xl mx-auto space-y-12"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    variants={fadeUp}
                >
                    <h3 className="text-3xl font-semibold text-gray-900">
                        Is this for you?
                    </h3>

                    <div className="grid md:grid-cols-2 gap-12">
                        <div>
                            <h4 className="text-xl font-semibold text-gray-900 mb-4">
                                Probably yes, if you:
                            </h4>
                            <ul className="space-y-3 text-gray-700">
                                {[
                                    "run your own infrastructure",
                                    "want a single trust boundary",
                                    "prefer control over convenience",
                                ].map((item, i) => (
                                    <motion.li
                                        key={item}
                                        initial={{ opacity: 0, y: 12 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.2 + i * 0.1 }}
                                    >
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-xl font-semibold text-gray-900 mb-4">
                                Probably not, if you:
                            </h4>
                            <ul className="space-y-3 text-gray-700">
                                {[
                                    "don’t want to self-host",
                                    "are looking for a managed service",
                                ].map((item, i) => (
                                    <motion.li
                                        key={item}
                                        initial={{ opacity: 0, y: 12 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.2 + i * 0.1 }}
                                    >
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </motion.div>
            </section>
        </>
    );
}