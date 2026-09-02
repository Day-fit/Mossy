import { motion, type Variants } from 'framer-motion';
import { useDevices } from '../../hooks/useDevices.ts';
import Button from '../shared/Button.tsx';
import DeviceCard from './DeviceCard.tsx';
import EnrollmentCard from './EnrollmentCard.tsx';

export default function DevicesHero() {
	const { devices, enrollments, isLoading, error, refreshDevices } =
		useDevices();
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
				<motion.div className="rounded-xl bg-white p-6 shadow-md">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<h2 className="mb-2 text-3xl font-semibold text-gray-900">
								Devices
							</h2>
							<p className="text-sm text-gray-600">
								Review enrollment requests and manage devices
								that can access your account.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							className="px-4 py-2 text-sm"
							disabled={isLoading}
							onClick={() => void refreshDevices()}
						>
							{isLoading ? 'Refreshing…' : 'Refresh'}
						</Button>
					</div>
					{error ? (
						<p role="alert" className="mt-4 text-sm text-red-600">
							{error}
						</p>
					) : null}
				</motion.div>

				{enrollments.length > 0 ? (
					<motion.section className="space-y-4">
						<div className="flex items-baseline gap-2">
							<h2 className="text-xl font-semibold text-gray-900">
								Pending enrollments
							</h2>
							<span className="text-sm text-gray-500">
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
					<h2 className="text-xl font-semibold text-gray-900">
						Existing devices
					</h2>
					{isLoading && devices.length === 0 ? (
						<p className="text-sm text-gray-500">
							Loading devices...
						</p>
					) : null}
					{!isLoading && devices.length === 0 ? (
						<p className="text-sm text-gray-500">
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
