import { formatDate } from '../../helpers/DateFormatHelper.ts';
import type { ActionType } from './index.ts';

const actionBadges: Record<ActionType, { label: string; className: string }> = {
    ADDED: {
        label: 'Added',
        className: 'bg-green-700 text-white',
    },
    REMOVED: {
        label: 'Removed',
        className: 'bg-red-700 text-white',
    },
    UPDATED: {
        label: 'Updated',
        className: 'bg-amber-700 text-white',
    },
};

type RecentActionElementProps = {
    actionType: ActionType;
    date: string;
    domain: string;
};

export default function RecentActionEntry({
    actionType,
    date,
    domain,
}: RecentActionElementProps) {
    const badge = actionBadges[actionType];

    return (
        <article className="flex w-full min-w-0 shrink-0 items-center gap-3 rounded-xl border border-gray-200/80 bg-gray-50/60 px-4 py-3.5 transition-colors hover:border-gray-300 hover:bg-gray-50 motion-reduce:transition-none">
            <div className="min-w-0 flex-1">
                <h3
                    className="truncate text-sm font-semibold leading-5 text-gray-900"
                    title={domain}
                >
                    {domain}
                </h3>
                <time
                    dateTime={date}
                    className="mt-1 block text-xs leading-4 tabular-nums text-gray-500"
                >
                    {formatDate(date)}
                </time>
            </div>
            <span
                className={`inline-flex min-w-18 shrink-0 items-center justify-center rounded px-2.5 py-1 text-xs font-medium leading-4 ${badge.className}`}
            >
                {badge.label}
            </span>
        </article>
    );
}
