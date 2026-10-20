import { Button } from '@mossy/ui';
import { MdPassword } from 'react-icons/md';
import type { Entry } from '../../types/models';
import type { Target } from '../../security/security';
import type { RunPopupAction } from './types';

type PasswordEntryProps = {
    entry: Entry;
    target: Target | undefined;
    permission: boolean;
    loading: boolean;
    action: RunPopupAction;
};

export default function PasswordEntry({
    entry,
    target,
    permission,
    loading,
    action,
}: PasswordEntryProps) {
    return (
        <article className="entry" key={entry.passwordId}>
            <div className="entry-heading">
                <span className="entry-symbol" aria-hidden="true">
                    <MdPassword size={18} />
                </span>
                <div className="entry-details">
                    <strong>{entry.identifier}</strong>
                    <span className="muted site">{entry.address}</span>
                </div>
            </div>
            <div className="row">
                <Button
                    padding="small"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void action('copy-username', entry)}
                >
                    Username
                </Button>
                <Button
                    padding="small"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void action('copy-password', entry)}
                >
                    Password
                </Button>
                <Button
                    padding="small"
                    title={
                        !permission
                            ? 'Enable website access in Settings to fill'
                            : !target
                              ? 'Open a matching login form to fill'
                              : 'Fill this login form'
                    }
                    disabled={loading || !permission || !target}
                    onClick={() => void action('fill', entry, target)}
                >
                    Fill
                </Button>
            </div>
        </article>
    );
}
