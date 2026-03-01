import {motion, stagger, type Variants} from "framer-motion";
import PasswordChart from "./PasswordChart.tsx";

export default function DashboardHero() {
    const containerVariants: Variants = {
        hidden: { opacity: 0, x: -50, scale: 0.98 },
        show: {
            opacity: 1,
            x: 0,
            scale: 1,
            transition: {
                duration: 0.5,
                ease: "easeOut",
                delayChildren: stagger(0.2),
            }
        }
    };

    const childVariants: Variants = {
        hidden: { opacity: 0, x: -50 },
        show: { opacity: 1, x: 0 }
    };

    return <section
        className="flex flex-col lg:flex-row min-h-[90vh] w-full items-center justify-center gap-5 sm:gap-10 lg:gap-20 my-5 px-4">
        <motion.section className="flex flex-col w-full lg:w-1/2 self-stretch gap-5 sm:gap-10"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
        >
            <motion.div className="h-64 sm:h-80 lg:h-1/2"
                        variants={childVariants}
            >
                <PasswordChart/>
            </motion.div>

            <motion.section className="flex h-64 sm:h-80 lg:h-1/2 justify-center items-center shadow-2xl rounded-md"
                            variants={childVariants}
            >
            </motion.section>
        </motion.section>
        <motion.aside className="flex flex-col w-full lg:w-1/3 self-stretch min-h-100 shadow-2xl rounded-md"
                      initial={{opacity: 0, x: 50}}
                      animate={{opacity: 1, x: 0}}
                      transition={{duration: 0.5, ease: "easeOut"}}
        >
            <section className="flex flex-col h-full items-center">
                <h2 className="text-lg text-gray-700 mt-5">Recent actions</h2>
            </section>
        </motion.aside>
    </section>
}