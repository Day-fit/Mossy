import { motion, type Variants } from 'framer-motion';
import { useDevices } from '../../hooks/useDevices.ts';
import DeviceCard from './DeviceCard.tsx';
import EnrollmentCard from './EnrollmentCard.tsx';

export default function DevicesHero() {
    const { devices, enrollments, isLoading, error } = useDevices();
    const containerVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        show: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.4,
                ease: 'easeOut',
                staggerChildren: 0.08,
            },
        },
    };

    return (
        <section className="w-full px-4 py-5">
            <motion.section
                className="mx-auto max-w-7xl space-y-6"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <motion.div className="rounded-xl bg-surface p-6 shadow-card">
                    <h2 className="mb-2 text-3xl">Devices</h2>
                    <p className="text-sm text-fg-muted">
                        Review enrollment requests and manage devices that can
                        access your account.
                    </p>
                    <p className="mt-3 text-xs text-fg-muted">
                        Device not showing up? Try refreshing the page.
                    </p>
                    {error ? (
                        <p role="alert" className="mt-4 text-sm text-danger">
                            {error}
                        </p>
                    ) : null}
                </motion.div>

                {enrollments.length > 0 ? (
                    <motion.section className="space-y-4">
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-xl">Pending enrollments</h2>
                            <span className="text-sm text-fg-muted">
                                {enrollments.length}
                            </span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {enrollments.map((enrollment) => (
                                <EnrollmentCard
                                    key={enrollment.id}
                                    enrollment={enrollment}
                                />
                            ))}
                        </div>
                    </motion.section>
                ) : null}

                <motion.section className="space-y-4">
                    <h2 className="text-xl">Existing devices</h2>
                    {isLoading && devices.length === 0 ? (
                        <p className="text-sm text-fg-muted">
                            Loading devices...
                        </p>
                    ) : null}
                    {!isLoading && devices.length === 0 ? (
                        <p className="text-sm text-fg-muted">
                            No devices available.
                        </p>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {devices.map((device) => (
                            <DeviceCard key={device.id} device={device} />
                        ))}
                    </div>
                </motion.section>
            </motion.section>
        </section>
    );
}
