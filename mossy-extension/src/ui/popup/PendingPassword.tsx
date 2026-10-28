import { Button } from '@mossy/ui';
import { motion, useReducedMotion } from 'framer-motion';
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
    const reduce = useReducedMotion();
    return (
        <motion.section
            className="min-w-0 rounded-xl border border-[color-mix(in_srgb,var(--color-fg-brand)_55%,var(--color-border))] bg-surface p-5 shadow-control max-[400px]:p-4"
            aria-label="Save captured password"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: reduce ? 0 : 0.22,
                ease: [0.22, 1, 0.36, 1],
            }}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-[1.0625rem] leading-[1.4]">
                    <MdLockOutline
                        className="text-fg-brand"
                        size={20}
                        aria-hidden="true"
                    />
                    {matches.length ? 'Update password?' : 'Save password?'}
                </h2>
                <button
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] size-[38px] flex-[0_0_38px] rounded-md border border-border bg-surface p-0 text-[19px] text-fg-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-fg-brand aria-expanded:border-fg-brand aria-expanded:bg-surface-subtle aria-expanded:text-fg-brand motion-safe:transition-[transform,background-color,border-color,color] cursor-pointer"
                    aria-label="Decline save"
                    disabled={loading}
                    onClick={() => onDismiss()}
                >
                    <MdClose />
                </button>
            </div>
            <div className="rounded-md bg-surface-subtle p-3 text-[0.8125rem] leading-[1.6] text-fg-secondary [overflow-wrap:anywhere] [&>p+p]:mt-[3px]">
                <p>{pending.origin}</p>
                <p>{pending.identifier}</p>
                <p
                    className="tracking-[2px] text-fg-muted"
                    aria-label="Masked captured password"
                >
                    ••••••••••••
                </p>
            </div>
            <Countdown deadline={pending.deadline} />
            {matches.length > 1 && (
                <>
                    <fieldset
                        className="mt-3.5 min-w-0 border-0 p-0"
                        disabled={loading}
                    >
                        <legend className="mb-2 block text-xs font-semibold text-fg-secondary">
                            Entry to update
                        </legend>
                        {matches.map((entry) => (
                            <label
                                key={entry.passwordId}
                                className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-md border border-border p-2.5 text-xs font-semibold text-fg-secondary has-checked:border-fg-brand has-checked:bg-surface-subtle"
                            >
                                <input
                                    className="shrink-0 accent-brand disabled:cursor-not-allowed disabled:opacity-60"
                                    type="radio"
                                    name="update-record"
                                    value={entry.passwordId}
                                    checked={updateId === entry.passwordId}
                                    onChange={() =>
                                        setUpdateId(entry.passwordId)
                                    }
                                />
                                <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
                                    <strong>{entry.identifier}</strong>
                                    <span className="text-[0.6875rem] font-normal text-fg-muted">
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
                <p className="mt-3 text-[0.8125rem] leading-[1.6] text-fg-muted [overflow-wrap:anywhere]">
                    Choose an online vault to save this login.
                </p>
            ) : (
                selected &&
                !hasVaultKey && (
                    <p className="mt-3 text-[0.8125rem] leading-[1.6] text-fg-muted [overflow-wrap:anywhere]">
                        Receive the vault key first, then submit this login
                        again to save it.
                    </p>
                )
            )}
            <Button
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer mt-4 w-full"
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
        </motion.section>
    );
}
