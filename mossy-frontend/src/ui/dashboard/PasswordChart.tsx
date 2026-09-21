import { motion } from 'framer-motion';
import { IoWarningOutline } from 'react-icons/io5';
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
import { globalStyleVar } from '../../theme/globalTokens.ts';

type PasswordData = {
    date: string;
    passwordCount: number;
    addedCount: number;
};

type ChartMode = 'total' | 'added';

type PasswordChartProps = {
    data: PasswordData[];
    error?: string | null;
    onRetry?: () => void;
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
    error = null,
    onRetry,
    emptyAction,
}: PasswordChartProps) {
    const [mode, setMode] = useState<ChartMode>('total');
    const isEmpty = data.length === 0;
    const showOverlay = isEmpty || Boolean(error);
    const overlayAction = error
        ? onRetry && { label: 'Retry', onClick: onRetry }
        : emptyAction;
    const chartData = isEmpty ? emptyChartData : data;
    const dataKey = mode === 'total' ? 'passwordCount' : 'addedCount';
    const lineName = mode === 'total' ? 'Total passwords' : 'Passwords added';

    return (
        <motion.div className="w-full h-full p-5 rounded-md flex flex-col justify-center items-center ">
            <div className="grid w-full grid-cols-3 items-center">
                <div />
                <h2 className="type-component-title justify-self-center text-fg-secondary whitespace-nowrap">
                    Secured passwords
                </h2>
                <div className="flex justify-self-end rounded-md bg-surface-muted p-1 type-caption">
                    <button
                        type="button"
                        disabled={showOverlay}
                        aria-pressed={mode === 'total'}
                        className={`rounded px-2 py-1 disabled:cursor-not-allowed disabled:text-fg-subtle ${!showOverlay && mode === 'total' ? 'bg-brand text-fg-inverse' : 'text-fg-muted'}`}
                        onClick={() => setMode('total')}
                    >
                        Total
                    </button>
                    <button
                        type="button"
                        disabled={showOverlay}
                        aria-pressed={mode === 'added'}
                        className={`rounded px-2 py-1 disabled:cursor-not-allowed disabled:text-fg-subtle ${!showOverlay && mode === 'added' ? 'bg-brand text-fg-inverse' : 'text-fg-muted'}`}
                        onClick={() => setMode('added')}
                    >
                        Added
                    </button>
                </div>
            </div>
            <div className="relative w-full h-full">
                <div
                    aria-hidden={showOverlay || undefined}
                    inert={showOverlay}
                    className={
                        showOverlay
                            ? 'w-full h-full pointer-events-none select-none blur-xs opacity-80'
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
                                stroke={globalStyleVar('chartPrimary')}
                                strokeWidth={3}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                {showOverlay ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-fg-secondary type-body-sm gap-3">
                        {error ? (
                            <IoWarningOutline
                                aria-hidden="true"
                                className="h-9 w-9 shrink-0 text-warning"
                            />
                        ) : null}
                        <p>
                            {error
                                ? 'Password history could not be loaded.'
                                : 'No password history yet.'}
                        </p>
                        {overlayAction ? (
                            <Button
                                type="button"
                                className="px-4 py-2 type-button-sm"
                                onClick={overlayAction.onClick}
                            >
                                {overlayAction.label}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </motion.div>
    );
}
