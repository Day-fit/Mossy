import { motion, stagger, type Variants } from "framer-motion";
import {useDashboardStatistics} from "../../hooks/useDashboardStatistics.ts";
import PasswordChart from "./PasswordChart.tsx";
import RecentActionSection from "./RecentActionSection.tsx";
import VaultDashboardView from "./VaultDashboardView.tsx";

export default function DashboardHero() {
    const {statistics, isLoading, error, reload} = useDashboardStatistics();

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
                            {isLoading ? (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    Loading statistics...
                                </div>
                            ) : (
                                <PasswordChart data={statistics.passwordChart} />
                            )}
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    className="flex-1 min-h-0"
                    variants={childVariants}
                >
                    <div className="h-full rounded-md shadow-2xl bg-white p-10 flex overflow-x-auto gap-5">
                        {!isLoading && error ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                                <p className="text-sm text-gray-500">{error}</p>
                                <button
                                    type="button"
                                    className="px-4 py-2 rounded-md bg-gray-200 text-gray-800"
                                    onClick={() => void reload()}
                                >
                                    Retry
                                </button>
                            </div>
                        ) : null}

                        {statistics.vaults.map((vault, index) => (
                            <VaultDashboardView
                                key={`${vault.vaultName}-${index}`}
                                passwordsCount={vault.passwordsCount}
                                vaultName={vault.vaultName}
                                isOnline={vault.isOnline}
                            />
                        ))}
                    </div>
                </motion.div>
            </motion.section>

            <div className="flex-1 min-h-0 overflow-hidden shadow-2xl">
                <RecentActionSection actions={statistics.recentActions} />
            </div>
        </section>
    );
}