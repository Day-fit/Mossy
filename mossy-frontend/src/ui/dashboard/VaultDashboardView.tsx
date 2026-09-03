import { GoDotFill } from 'react-icons/go';
import Button from '../shared/Button.tsx';

type VaultDashboardViewProps = {
	passwordsCount: number;
	isOnline: boolean;
	name: string;
	lastSeenAt: string | null;
	isSelected: boolean;
	onSelect: () => void;
};

export default function VaultDashboardView({
	passwordsCount,
	isOnline,
	name,
	lastSeenAt,
	isSelected,
	onSelect,
}: VaultDashboardViewProps) {
	const formattedLastSeenAt = lastSeenAt
		? new Date(lastSeenAt).toLocaleString()
		: 'Never';

	return (
		<Button
			type="button"
			variant="ghost"
			onClick={onSelect}
			aria-pressed={isSelected}
			className={`border-2 rounded-md p-4 h-full aspect-square flex flex-col text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
				isSelected
					? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-100'
					: 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20'
			}`}
		>
			<div className="flex justify-around items-center">
				<h3 className="text-4xl sm:text-3xl">{name}</h3>

				<div className={'flex items-center'}>
					<GoDotFill
						className={`text-xl sm:text-2xl ${isOnline ? 'text-green-500' : 'text-red-500'}`}
					/>
					<h3 className="text-xs sm:text-sm">
						{isOnline ? 'Online' : 'Offline'}
					</h3>
				</div>
			</div>

			<p className="mt-3 text-xs text-gray-500">
				Last seen: {formattedLastSeenAt}
			</p>

			<div className="mt-auto flex items-end justify-between gap-3">
				{isSelected && (
					<span className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
						<GoDotFill
							className="text-emerald-200"
							aria-hidden="true"
						/>
						Selected
					</span>
				)}

				<h1 className="ml-auto text-8xl sm:text-8xl text-right">
					{passwordsCount}
				</h1>
			</div>
		</Button>
	);
}
