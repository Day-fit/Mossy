import { GoDotFill } from 'react-icons/go';

type VaultStatusProps = {
    isOnline: boolean;
    lastSeenAt: string | null;
    inverse?: boolean;
};

export default function VaultStatus({
    isOnline,
    lastSeenAt,
    inverse = false,
}: VaultStatusProps) {
    const hasConnected = Boolean(lastSeenAt);
    const label = isOnline
        ? 'Online'
        : hasConnected
          ? 'Offline'
          : 'Never connected';
    const tone = inverse
        ? 'text-fg-inverse'
        : isOnline
          ? 'text-success'
          : hasConnected
            ? 'text-warning'
            : 'text-fg-muted';
    const hint = isOnline
        ? 'The vault is connected and ready to manage passwords.'
        : lastSeenAt
          ? `Last connected: ${new Date(lastSeenAt).toLocaleString()}. Start your self-hosted vault and its database to reconnect.`
          : 'This vault has not connected yet. Start your self-hosted vault and its database to connect.';

    return (
        <span
            className={`inline-flex items-center gap-1 text-sm font-normal ${tone}`}
            title={hint}
        >
            <GoDotFill size={16} className="shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
}
