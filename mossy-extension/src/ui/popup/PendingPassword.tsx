import { Button } from '@mossy/ui';
import { MdClose } from 'react-icons/md';
import type { PendingMetadata } from '../../capture/PendingCapture';
import type { Entry } from '../../types/models';
import type { RunPopupAction } from './types';

type PendingPasswordProps = {
    pending: PendingMetadata;
    matches: Entry[];
    now: number;
    loading: boolean;
    selected: string | undefined;
    updateId: string;
    setUpdateId: (id: string) => void;
    action: RunPopupAction;
    onDismiss: () => void;
};

export default function PendingPassword({
    pending,
    matches,
    now,
    loading,
    selected,
    updateId,
    setUpdateId,
    action,
    onDismiss,
}: PendingPasswordProps) {
    return (
        <section className="panel pending" aria-label="Save captured password">
            <div className="section-heading">
                <h2>
                    {matches.length ? 'Update password?' : 'Save password?'}
                </h2>
                <button
                    className="icon"
                    aria-label="Decline save"
                    onClick={() => onDismiss()}
                >
                    <MdClose />
                </button>
            </div>
            <div className="capture-details">
                <p>{pending.origin}</p>
                <p>{pending.identifier}</p>
                <p
                    className="capture-mask"
                    aria-label="Masked captured password"
                >
                    ••••••••••••
                </p>
            </div>
            <p role="timer">
                Expires in{' '}
                {Math.max(0, Math.ceil((pending.deadline - now) / 1000))}{' '}
                seconds
            </p>
            {matches.length > 1 && (
                <>
                    <label htmlFor="update-record">Entry to update</label>
                    <select
                        id="update-record"
                        value={updateId}
                        onChange={(event) => setUpdateId(event.target.value)}
                    >
                        <option value="">Choose an entry</option>
                        {matches.map((entry) => (
                            <option
                                key={entry.passwordId}
                                value={entry.passwordId}
                            >
                                {entry.identifier} · {entry.address} ·{' '}
                                {entry.lastModified}
                            </option>
                        ))}
                    </select>
                </>
            )}
            <Button
                padding="medium"
                disabled={
                    loading ||
                    !selected ||
                    (matches.length > 1 &&
                        !matches.some((entry) => entry.passwordId === updateId))
                }
                onClick={() =>
                    void action(
                        'save',
                        matches.length === 1
                            ? matches[0]
                            : matches.find(
                                  (entry) => entry.passwordId === updateId
                              )
                    )
                }
            >
                {matches.length ? 'Authorize update' : 'Authorize save'}
            </Button>
        </section>
    );
}
