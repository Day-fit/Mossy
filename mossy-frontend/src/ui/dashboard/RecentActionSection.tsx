import { motion } from 'framer-motion';
import { IoWarningOutline } from 'react-icons/io5';
import RecentActionEntry from './RecentActionEntry.tsx';
import type { ActionType } from './index.ts';
import Button from '../shared/Button.tsx';

type RecentAction = {
    date: string;
    actionType: ActionType;
    domain: string;
};

const emptyActions: RecentAction[] = [
    { date: '2025-01-04', actionType: 'ADDED', domain: 'example.com' },
    { date: '2025-01-03', actionType: 'UPDATED', domain: 'mail.example.com' },
    { date: '2025-01-02', actionType: 'REMOVED', domain: 'shop.example.com' },
    { date: '2025-01-01', actionType: 'ADDED', domain: 'work.example.com' },
];

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
    const overlayAction = error
        ? onRetry && { label: 'Retry', onClick: onRetry }
        : emptyAction;

    return (
        <motion.aside
            className="flex flex-col min-h-100 lg:flex-1 lg:min-h-0 rounded-md bg-surface shadow-card"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            <h2 className="text-lg font-semibold leading-[1.5] text-fg-secondary mt-5 text-center shrink-0">
                Recent actions
            </h2>

            <div className="flex flex-1 min-h-0 flex-col gap-2 px-4 py-4 overflow-y-auto items-center scrollbar">
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center text-sm text-fg-muted">
                        Loading recent actions...
                    </div>
                ) : error || actions.length === 0 ? (
                    <div className="relative w-full flex-1 overflow-hidden">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none flex w-full select-none flex-col gap-2 blur-xs opacity-80"
                        >
                            {(actions.length === 0
                                ? emptyActions
                                : actions
                            ).map((action, index) => (
                                <RecentActionEntry
                                    key={`${action.domain}-${action.date}-${index}`}
                                    {...action}
                                />
                            ))}
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-sm text-fg-secondary">
                            {error ? (
                                <IoWarningOutline
                                    aria-hidden="true"
                                    className="h-9 w-9 shrink-0 text-warning"
                                />
                            ) : null}
                            <p>
                                {error
                                    ? 'Recent actions could not be loaded.'
                                    : 'No actions yet.'}
                            </p>
                            {overlayAction ? (
                                <Button
                                    type="button"
                                    className="text-sm"
                                    onClick={overlayAction.onClick}
                                >
                                    {overlayAction.label}
                                </Button>
                            ) : null}
                        </div>
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
