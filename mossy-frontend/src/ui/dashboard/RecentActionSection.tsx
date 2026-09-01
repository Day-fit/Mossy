import { motion } from 'framer-motion';
import RecentActionEntry from './RecentActionEntry.tsx';
import type { ActionType } from './index.ts';
import Button from '../shared/Button.tsx';

type RecentAction = {
	date: string;
	actionType: ActionType;
	domain: string;
};

type RecentActionSectionProps = {
	actions: RecentAction[];
	isLoading?: boolean;
	error?: string | null;
	onRetry?: () => void;
	emptyAction?: {
		label: string;
		onClick: () => void;
	};
};

export default function RecentActionSection({
	actions,
	isLoading = false,
	error = null,
	onRetry,
	emptyAction,
}: RecentActionSectionProps) {
	return (
		<motion.aside
			className="flex flex-col min-h-100 lg:flex-1 lg:min-h-0 rounded-md bg-white shadow-2xl"
			initial={{ opacity: 0, x: 50 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.5, ease: 'easeOut' }}
		>
			<h2 className="text-lg text-gray-700 mt-5 text-center shrink-0">
				Recent actions
			</h2>

			<div className="flex flex-col lg:flex-1 lg:min-h-0 gap-2 px-4 py-4 overflow-y-auto items-center scrollbar">
				{isLoading ? (
					<div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
						Loading recent actions...
					</div>
				) : error && actions.length === 0 ? (
					<div className="w-full h-full flex flex-col items-center justify-center text-center text-sm text-gray-500 gap-3">
						<p>Recent actions could not be loaded.</p>
						{onRetry ? (
							<Button
								type="button"
								className="px-4 py-2 text-sm"
								onClick={onRetry}
							>
								Retry
							</Button>
						) : null}
					</div>
				) : actions.length === 0 ? (
					<div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
						<p>No actions yet.</p>
						{emptyAction ? (
							<Button
								type="button"
								className="px-4 py-2 text-sm"
								onClick={emptyAction.onClick}
							>
								{emptyAction.label}
							</Button>
						) : null}
					</div>
				) : (
					actions.map((action, index) => (
						<RecentActionEntry
							key={`${action.domain}-${action.date}-${index}`}
							date={action.date}
							actionType={action.actionType}
							domain={action.domain}
						/>
					))
				)}
			</div>
		</motion.aside>
	);
}
