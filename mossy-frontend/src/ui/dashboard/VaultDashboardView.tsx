import { GoDotFill } from 'react-icons/go';
import { MdOpenInNew } from 'react-icons/md';
import Button from '../shared/Button.tsx';
import VaultStatus from '../shared/VaultStatus.tsx';
import {
    formatDateTime,
    formatRelativeTime,
} from '../../helpers/DateFormatHelper.ts';

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
    return (
        <article
            className={`min-w-0 rounded-md border-2 focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${
                isSelected
                    ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                    : 'border-border bg-surface hover:border-brand/20 hover:bg-brand/5'
            }`}
        >
            <Button
                type="button"
                variant="ghost"
                padding="none"
                onClick={onSelect}
                aria-label={`Select ${name}`}
                aria-pressed={isSelected}
                className="flex w-full flex-col gap-1 px-4 pt-3 pb-1 text-left focus-visible:outline-none"
            >
                <div className="flex w-full min-w-0 items-center justify-between gap-3">
                    <h3 className="truncate text-lg" title={name}>
                        {name}
                    </h3>
                    <span className="shrink-0">
                        <VaultStatus
                            isOnline={isOnline}
                            lastSeenAt={lastSeenAt}
                        />
                    </span>
                </div>

                <div className="flex min-h-5 w-full items-center justify-between gap-3">
                    <p className="text-sm font-normal text-fg-secondary">
                        {passwordsCount}{' '}
                        {passwordsCount === 1 ? 'password' : 'passwords'}
                    </p>
                    {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs leading-4 text-fg-inverse">
                            <GoDotFill
                                className="text-fg-inverse/80"
                                aria-hidden="true"
                            />
                            Selected
                        </span>
                    )}
                </div>
            </Button>

            <div className="flex min-h-9 items-center justify-between gap-3 px-4 pb-3">
                <p className="min-w-0 text-xs text-fg-muted">
                    Last connected:{' '}
                    {lastSeenAt ? (
                        <time
                            dateTime={lastSeenAt}
                            title={formatDateTime(lastSeenAt)}
                        >
                            {formatRelativeTime(lastSeenAt)}
                        </time>
                    ) : (
                        'Never'
                    )}
                </p>
                {!isOnline && (
                    <a
                        href="https://github.com/Day-fit/Mossy#run-only-the-vault-probably-what-you-are-looking-for"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Go online: startup instructions for ${name}`}
                        className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-sm text-xs font-semibold text-brand underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                        Go online
                        <MdOpenInNew size={14} aria-hidden="true" />
                    </a>
                )}
            </div>
        </article>
    );
}
