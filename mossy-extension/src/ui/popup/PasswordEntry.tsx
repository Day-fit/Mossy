import { Button } from '@mossy/ui';
import {
    MdContentCopy,
    MdLogin,
    MdPassword,
    MdPersonOutline,
} from 'react-icons/md';
import type { Entry } from '../../types/models';
import type { Target } from '../../security/security';
import type { RunPopupAction } from './types';

const actionButtonClassName =
    'inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-9 min-w-0 flex-1 px-2 py-[5px] text-[0.75rem] last:flex-[0_0_72px] max-[400px]:last:col-span-full cursor-pointer';

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
        <article
            className="entry rounded-lg border border-border p-3 hover:border-border-strong"
            key={entry.passwordId}
        >
            <div className="mb-3 flex items-center gap-2.5">
                <span
                    className="grid size-9 flex-[0_0_36px] place-items-center rounded-[9px] border border-border bg-surface-subtle text-fg-brand"
                    aria-hidden="true"
                >
                    <MdPassword size={18} />
                </span>
                <div className="min-w-0">
                    <strong className="block text-sm leading-normal [overflow-wrap:anywhere]">
                        {entry.identifier}
                    </strong>
                    <span className="text-xs leading-normal text-fg-muted block [overflow-wrap:anywhere]">
                        {entry.address}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2 max-[400px]:grid max-[400px]:grid-cols-2">
                <Button
                    className={actionButtonClassName}
                    padding="none"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void action('copy-username', entry)}
                >
                    <MdPersonOutline size={16} aria-hidden="true" />
                    Username
                </Button>
                <Button
                    className={actionButtonClassName}
                    padding="none"
                    variant="outline"
                    disabled={loading}
                    onClick={() => void action('copy-password', entry)}
                >
                    <MdContentCopy size={15} aria-hidden="true" />
                    Password
                </Button>
                <Button
                    className={actionButtonClassName}
                    padding="none"
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
                    <MdLogin size={16} aria-hidden="true" />
                    Fill
                </Button>
            </div>
        </article>
    );
}
