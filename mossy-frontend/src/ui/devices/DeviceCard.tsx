import { motion } from 'framer-motion';
import { useState } from 'react';
import type { DeviceDetails } from '../../api/deviceTrust.api.ts';
import { useDevices } from '../../hooks/useDevices.ts';
import Button from '../shared/Button.tsx';
import ActionModal from '../shared/ActionModal.tsx';
import { DeviceIcon } from './deviceIcon.tsx';

export default function DeviceCard({ device }: { device: DeviceDetails }) {
    const { actionId, blockDevice, unblockDevice } = useDevices();
    const [isConfirming, setIsConfirming] = useState(false);
    const isUpdating = actionId === device.id;
    const action = device.blocked ? unblockDevice : blockDevice;
    const actionLabel = device.blocked ? 'Unblock' : 'Block';

    const confirmAction = async () => {
        if (await action(device.id)) setIsConfirming(false);
    };

    return (
        <>
            <motion.article
                className="rounded-xl border border-border bg-surface-card p-5 shadow-card"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-brand-subtle p-3 text-3xl text-brand">
                        <DeviceIcon deviceType={device.deviceType} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate type-component-title text-fg-primary">
                                {device.lastOsName || 'Unknown OS'}
                            </h3>
                            {device.current ? (
                                <span className="rounded-full bg-brand-muted px-2 py-0.5 type-caption-strong text-brand">
                                    Current device
                                </span>
                            ) : null}
                        </div>
                        <p
                            className={`mt-1 type-body-sm ${device.blocked ? 'text-danger' : 'text-success'}`}
                        >
                            {device.deviceType || 'Unknown device'} ·{' '}
                            {device.blocked ? 'Blocked' : 'Active'}
                        </p>
                    </div>
                </div>

                <dl className="mt-5 space-y-3 type-body-sm">
                    <div>
                        <dt className="type-caption-strong text-fg-muted">
                            Device ID
                        </dt>
                        <dd className="mt-1 break-all type-code-sm text-fg-secondary">
                            {device.id}
                        </dd>
                    </div>
                    <div>
                        <dt className="type-caption-strong text-fg-muted">
                            Last seen
                        </dt>
                        <dd className="text-fg-secondary">
                            {device.lastSeen
                                ? new Date(device.lastSeen).toLocaleString()
                                : 'Never'}
                        </dd>
                    </div>
                </dl>

                {!device.current ? (
                    <Button
                        type="button"
                        variant={device.blocked ? 'primary' : 'outline'}
                        className="mt-5 px-4 py-2 type-button-sm"
                        disabled={actionId !== null}
                        onClick={() => setIsConfirming(true)}
                    >
                        {isUpdating ? 'Updating…' : actionLabel}
                    </Button>
                ) : null}
            </motion.article>

            {isConfirming ? (
                <ActionModal
                    title={`${actionLabel} device`}
                    description={
                        device.blocked
                            ? 'This device will be allowed to authenticate again.'
                            : 'This device will no longer be allowed to authenticate.'
                    }
                    confirmLabel={isUpdating ? 'Updating…' : actionLabel}
                    confirmDisabled={actionId !== null}
                    onClose={() => setIsConfirming(false)}
                    onConfirm={() => void confirmAction()}
                />
            ) : null}
        </>
    );
}
