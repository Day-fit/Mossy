import { motion } from 'framer-motion';
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { formatDate } from '../../helpers/DateFormatHelper.ts';
import RippleButton from '../layout/RippleButton.tsx';

type PasswordData = {
	date: string;
	addedCount: number;
};

type PasswordChartProps = {
	data?: PasswordData[];
	emptyAction?: {
		label: string;
		onClick: () => void;
	};
};

export default function PasswordChart({
	data,
	emptyAction,
}: PasswordChartProps) {
	const chartData = data ?? [];

	return (
		<motion.div className="w-full h-full p-5 rounded-md flex flex-col justify-center items-center ">
			<h2 className="text-lg text-gray-700">Secured passwords</h2>
			{chartData.length === 0 ? (
				<div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
					<p>No password history yet.</p>
					{emptyAction ? (
						<RippleButton
							type="button"
							className="px-4 py-2 text-sm"
							onClick={emptyAction.onClick}
						>
							{emptyAction.label}
						</RippleButton>
					) : null}
				</div>
			) : (
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={chartData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="date" tickFormatter={formatDate} />
						<YAxis />
						<Tooltip
							labelFormatter={(value) =>
								formatDate(value as string)
							}
						/>
						<Line
							type="monotone"
							dataKey="addedCount"
							stroke="#00bc7d"
							strokeWidth={3}
						/>
					</LineChart>
				</ResponsiveContainer>
			)}
		</motion.div>
	);
}
