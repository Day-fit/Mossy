import { motion, stagger, type Variants } from "framer-motion";
import PasswordChart from "./PasswordChart.tsx";
import RecentActionSection from "./RecentActionSection.tsx";

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
            },
        },
    };

    const childVariants: Variants = {
        hidden: { opacity: 0, x: -50 },
        show: { opacity: 1, x: 0 },
    };

    return (
        <section className="flex flex-col lg:flex-row h-[90vh] gap-8 px-4 my-5">
            <motion.section
                className="flex flex-col flex-1 gap-8 min-h-0"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <motion.div
                    className="flex-1 min-h-0"
                    variants={childVariants}
                >
                    <div className="h-full rounded-md shadow-2xl bg-white">
                        <div className="h-full overflow-hidden rounded-md p-4">
                            <PasswordChart />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    className="flex-1 min-h-0"
                    variants={childVariants}
                >
                    <div className="h-full rounded-md shadow-2xl bg-white">
                        <div className="h-full overflow-hidden rounded-md">
                            {/* future content */}
                        </div>
                    </div>
                </motion.div>
            </motion.section>

            <div className="flex-1 min-h-0 overflow-hidden">
                <RecentActionSection />
            </div>
        </section>
    );
}