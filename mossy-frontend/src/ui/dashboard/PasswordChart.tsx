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
import Button from '../shared/Button.tsx';
import { useState } from 'react';

type PasswordData = {
	date: string;
	passwordCount: number;
	addedCount: number;
};

type ChartMode = 'total' | 'added';

type PasswordChartProps = {
	data: PasswordData[];
	emptyAction?: {
		label: string;
		onClick: () => void;
	};
};

const emptyChartData: PasswordData[] = [
	{ date: '2025-01-01', passwordCount: 1, addedCount: 1 },
	{ date: '2025-01-02', passwordCount: 4, addedCount: 3 },
	{ date: '2025-01-03', passwordCount: 6, addedCount: 2 },
	{ date: '2025-01-04', passwordCount: 10, addedCount: 4 },
];

export default function PasswordChart({
	data,
	emptyAction,
}: PasswordChartProps) {
	const [mode, setMode] = useState<ChartMode>('total');
	const isEmpty = data.length === 0;
	const chartData = isEmpty ? emptyChartData : data;
	const dataKey = mode === 'total' ? 'passwordCount' : 'addedCount';
	const lineName = mode === 'total' ? 'Total passwords' : 'Passwords added';

	return (
		<motion.div className="w-full h-full p-5 rounded-md flex flex-col justify-center items-center ">
			<div className="grid w-full grid-cols-3 items-center">
				<div />
				<h2 className="justify-self-center text-lg text-gray-700 whitespace-nowrap">
					Secured passwords
				</h2>
				<div className="flex justify-self-end rounded-md bg-gray-100 p-1 text-xs">
					<button
						type="button"
						disabled={isEmpty}
						aria-pressed={mode === 'total'}
						className={`rounded px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:text-gray-400 ${!isEmpty && mode === 'total' ? 'bg-green-700 text-white' : 'text-gray-600'}`}
						onClick={() => setMode('total')}
					>
						Total
					</button>
					<button
						type="button"
						disabled={isEmpty}
						aria-pressed={mode === 'added'}
						className={`rounded px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:text-gray-400 ${!isEmpty && mode === 'added' ? 'bg-green-700 text-white' : 'text-gray-600'}`}
						onClick={() => setMode('added')}
					>
						Added
					</button>
				</div>
			</div>
			<div className="relative w-full h-full">
				<div
					className={
						isEmpty
							? 'w-full h-full blur-xs opacity-80'
							: 'w-full h-full'
					}
				>
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" tickFormatter={formatDate} />
							<YAxis
								allowDecimals={false}
								domain={[
									(dataMin: number) =>
										Math.max(0, dataMin - 1),
									(dataMax: number) => dataMax + 1,
								]}
							/>
							<Tooltip
								labelFormatter={(value) =>
									formatDate(value as string)
								}
							/>
							<Line
								key={dataKey}
								type="monotone"
								dataKey={dataKey}
								name={lineName}
								stroke="#00bc7d"
								strokeWidth={3}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
				{isEmpty ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 text-sm gap-3">
						<p>No password history yet.</p>
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
				) : null}
			</div>
		</motion.div>
	);
}
