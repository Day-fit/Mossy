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
            className={`border-2 h-full aspect-square flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                isSelected
                    ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                    : 'border-border bg-surface hover:border-brand/20 hover:bg-brand/5'
            }`}
        >
            <div className="flex justify-around items-center">
                <h3 className="text-3xl">{name}</h3>

                <div className={'flex items-center'}>
                    <GoDotFill
                        className={`text-xl sm:text-2xl ${isOnline ? 'text-success' : 'text-danger'}`}
                    />
                    <span className="text-sm font-normal">
                        {isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>
            </div>

            <p className="mt-3 text-xs font-normal text-fg-muted">
                Last seen: {formattedLastSeenAt}
            </p>

            <div className="mt-auto flex items-end justify-between gap-3">
                {isSelected && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs text-fg-inverse shadow-control">
                        <GoDotFill
                            className="text-fg-inverse/80"
                            aria-hidden="true"
                        />
                        Selected
                    </span>
                )}

                <p className="text-8xl font-normal ml-auto text-right">
                    {passwordsCount}
                </p>
            </div>
        </Button>
    );
}
