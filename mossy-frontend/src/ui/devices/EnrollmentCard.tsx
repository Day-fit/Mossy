import { motion } from 'framer-motion';
import type { DeviceEnrollment } from '../../api/deviceTrust.api.ts';
import { useDevices } from '../../hooks/useDevices.ts';
import Button from '../shared/Button.tsx';
import { DeviceIcon } from './deviceIcon.tsx';

export default function EnrollmentCard({
    enrollment,
}: {
    enrollment: DeviceEnrollment;
}) {
    const { actionId, approveEnrollment } = useDevices();
    const isApproving = actionId === enrollment.id;

    return (
        <motion.article
            className="rounded-xl border border-border bg-surface-card p-5 shadow-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex items-start gap-4">
                <div className="rounded-lg bg-warning-subtle p-3 text-3xl text-warning">
                    <DeviceIcon deviceType={enrollment.deviceType} />
                </div>
                <div className="min-w-0">
                    <h3 className="truncate type-component-title text-fg-primary">
                        {enrollment.lastOsName || 'Unknown OS'}
                    </h3>
                    <p className="type-body-sm text-warning">
                        {enrollment.deviceType || 'Unknown device'} · Awaiting
                        approval
                    </p>
                </div>
            </div>
            <dl className="mt-5 space-y-2 type-body-sm text-fg-secondary">
                <div>
                    <dt className="type-caption-strong text-fg-muted">
                        IP address
                    </dt>
                    <dd>{enrollment.remoteAddr}</dd>
                </div>
                <div>
                    <dt className="type-caption-strong text-fg-muted">
                        Requested
                    </dt>
                    <dd>{new Date(enrollment.createdAt).toLocaleString()}</dd>
                </div>
            </dl>
            <Button
                type="button"
                className="mt-5 px-4 py-2 type-button-sm text-fg-inverse"
                disabled={actionId !== null}
                onClick={() => void approveEnrollment(enrollment.id)}
            >
                {isApproving ? 'Approving…' : 'Approve'}
            </Button>
        </motion.article>
    );
}
