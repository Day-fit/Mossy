import {
    formatDateTime,
    formatRelativeTime,
} from '../../helpers/DateFormatHelper.ts';
import type { ActionType } from './index.ts';

const actionBadges: Record<ActionType, { label: string; className: string }> = {
    ADDED: {
        label: 'Added',
        className: 'bg-success text-fg-inverse',
    },
    REMOVED: {
        label: 'Removed',
        className: 'bg-danger text-fg-inverse',
    },
    UPDATED: {
        label: 'Updated',
        className: 'bg-warning text-fg-inverse',
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
        <article className="flex w-full min-w-0 shrink-0 items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3.5">
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium" title={domain}>
                    {domain}
                </h3>
                <time
                    dateTime={date}
                    title={formatDateTime(date)}
                    className="mt-1 block text-xs tabular-nums text-fg-muted"
                >
                    {formatRelativeTime(date)}
                </time>
            </div>
            <span
                className={`inline-flex min-w-18 shrink-0 items-center justify-center rounded px-2.5 py-1 text-xs font-semibold ${badge.className}`}
            >
                {badge.label}
            </span>
        </article>
    );
}
