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
            className={`border-2 rounded-md p-4 h-full aspect-square flex flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
                isSelected
                    ? 'border-brand bg-brand-subtle/50 ring-2 ring-brand-muted'
                    : 'border-border bg-surface-card hover:border-brand-muted hover:bg-brand-subtle/20'
            }`}
        >
            <div className="flex justify-around items-center">
                <h3 className="type-section-title">{name}</h3>

                <div className={'flex items-center'}>
                    <GoDotFill
                        className={`text-xl sm:text-2xl ${isOnline ? 'text-success' : 'text-danger'}`}
                    />
                    <h3 className="type-body-sm">
                        {isOnline ? 'Online' : 'Offline'}
                    </h3>
                </div>
            </div>

            <p className="mt-3 type-caption text-fg-muted">
                Last seen: {formattedLastSeenAt}
            </p>

            <div className="mt-auto flex items-end justify-between gap-3">
                {isSelected && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 type-caption-strong text-fg-inverse shadow-control">
                        <GoDotFill
                            className="text-brand-muted"
                            aria-hidden="true"
                        />
                        Selected
                    </span>
                )}

                <p className="type-metric ml-auto text-right">
                    {passwordsCount}
                </p>
            </div>
        </Button>
    );
}
