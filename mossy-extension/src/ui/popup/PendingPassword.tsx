import { Button } from '@mossy/ui';
import { MdClose, MdKey, MdLockOutline } from 'react-icons/md';
import Countdown from '../shared/Countdown';
import type { PendingMetadata } from '../../capture/PendingCapture';
import type { Entry } from '../../types/models';
import type { RunPopupAction } from './types';

type PendingPasswordProps = {
    pending: PendingMetadata;
    matches: Entry[];
    loading: boolean;
    selected: string | undefined;
    updateId: string;
    setUpdateId: (id: string) => void;
    action: RunPopupAction;
    onDismiss: () => void;
    hasVaultKey: boolean;
    onReceiveKey: () => void;
    vaultOffline: boolean;
};

export default function PendingPassword({
    pending,
    matches,
    loading,
    selected,
    updateId,
    setUpdateId,
    action,
    onDismiss,
    hasVaultKey,
    onReceiveKey,
    vaultOffline,
}: PendingPasswordProps) {
    return (
        <section className="panel pending" aria-label="Save captured password">
            <div className="section-heading">
                <h2>
                    <MdLockOutline size={20} aria-hidden="true" />
                    {matches.length ? 'Update password?' : 'Save password?'}
                </h2>
                <button
                    className="icon"
                    aria-label="Decline save"
                    disabled={loading}
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
            <Countdown deadline={pending.deadline} />
            {matches.length > 1 && (
                <>
                    <fieldset className="update-choices" disabled={loading}>
                        <legend>Entry to update</legend>
                        {matches.map((entry) => (
                            <label
                                key={entry.passwordId}
                                className="update-choice"
                            >
                                <input
                                    type="radio"
                                    name="update-record"
                                    value={entry.passwordId}
                                    checked={updateId === entry.passwordId}
                                    onChange={() =>
                                        setUpdateId(entry.passwordId)
                                    }
                                />
                                <span>
                                    <strong>{entry.identifier}</strong>
                                    <span>
                                        {entry.address} ·{' '}
                                        {new Date(
                                            entry.lastModified
                                        ).toLocaleDateString()}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                </>
            )}
            {vaultOffline ? (
                <p className="key-save-hint">
                    Choose an online vault to save this login.
                </p>
            ) : (
                selected &&
                !hasVaultKey && (
                    <p className="key-save-hint">
                        Receive the vault key first, then submit this login
                        again to save it.
                    </p>
                )
            )}
            <Button
                padding="medium"
                disabled={
                    loading ||
                    vaultOffline ||
                    !selected ||
                    (hasVaultKey &&
                        matches.length > 1 &&
                        !matches.some((entry) => entry.passwordId === updateId))
                }
                onClick={() =>
                    hasVaultKey
                        ? void action(
                              'save',
                              matches.length === 1
                                  ? matches[0]
                                  : matches.find(
                                        (entry) => entry.passwordId === updateId
                                    )
                          )
                        : onReceiveKey()
                }
            >
                {!hasVaultKey && !vaultOffline && (
                    <MdKey size={18} aria-hidden="true" />
                )}
                {vaultOffline
                    ? 'Choose an online vault'
                    : !hasVaultKey
                      ? 'Receive vault key'
                      : matches.length
                        ? 'Authorize update'
                        : 'Authorize save'}
            </Button>
        </section>
    );
}
