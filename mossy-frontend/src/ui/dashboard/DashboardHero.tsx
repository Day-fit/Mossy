import { motion, stagger, type Variants } from 'framer-motion';
import { useDashboardStatistics } from '../../hooks/useDashboardStatistics.ts';
import PasswordChart from './PasswordChart.tsx';
import RecentActionSection from './RecentActionSection.tsx';
import VaultDashboardView from './VaultDashboardView.tsx';
import { useVault } from '../../hooks/useVault.ts';
import RippleButton from '../layout/RippleButton.tsx';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export default function DashboardHero() {
	const { statistics, isLoading, error, reload } = useDashboardStatistics();
	const { vaults } = useVault();
	const navigate = useNavigate();
	const addPasswordAction = useMemo(
		() => ({
			label: 'Add a password',
			onClick: () => navigate('/passwords'),
		}),
		[navigate]
	);

	const containerVariants: Variants = {
		hidden: { opacity: 0, x: -50, scale: 0.98 },
		show: {
			opacity: 1,
			x: 0,
			scale: 1,
			transition: {
				duration: 0.5,
				ease: 'easeOut',
				delayChildren: stagger(0.2),
			},
		},
	};

	const childVariants: Variants = {
		hidden: { opacity: 0, x: -50 },
		show: { opacity: 1, x: 0 },
	};

	return (
		<section className="flex flex-col lg:flex-row lg:h-[90vh] gap-8 px-4 py-2 overflow-x-hidden">
			<motion.section
				className="flex flex-col flex-1 gap-8 min-h-0"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				<motion.div
					className="lg:flex-1 lg:min-h-0"
					variants={childVariants}
				>
					<div className="h-full rounded-md shadow-2xl bg-white">
						<div className="h-full overflow-hidden rounded-md p-4">
							{isLoading ? (
								<div className="w-full h-full flex items-center justify-center text-gray-500">
									Loading statistics...
								</div>
							) : (
								<PasswordChart
									data={statistics.passwordChart}
									emptyAction={addPasswordAction}
								/>
							)}
						</div>
					</div>
				</motion.div>

				<motion.div className="flex-1 min-h-0" variants={childVariants}>
					<div className="h-full rounded-md shadow-2xl bg-white p-10 flex overflow-x-auto gap-5">
						{!isLoading && !error && vaults.length === 0 ? (
							<div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
								<p>No vaults yet.</p>
								<RippleButton
									type="button"
									className="px-4 py-2 text-sm"
									onClick={() => navigate('/vaults')}
								>
									Create a vault
								</RippleButton>
							</div>
						) : null}

						{vaults.map((vault) => {
							const vaultName = vault.vaultName ?? vault.vaultId;
							return (
								<VaultDashboardView
									key={vault.vaultId}
									passwordsCount={vault.passwordCount}
									name={vaultName}
									isOnline={vault.isOnline}
									lastSeenAt={vault.lastSeenAt}
								/>
							);
						})}
					</div>
				</motion.div>
			</motion.section>

			<div className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
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

				{!error && (
					<RecentActionSection
						actions={statistics.recentActions}
						emptyAction={addPasswordAction}
					/>
				)}
			</div>
		</section>
	);
}
