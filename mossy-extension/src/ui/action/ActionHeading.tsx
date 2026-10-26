import {
    MdFingerprint,
    MdLockOutline,
    MdCheckCircleOutline,
    MdErrorOutline,
} from 'react-icons/md';
import type { Action as ActionModel } from '../../types/models';
import { motion, useReducedMotion } from 'framer-motion';
import {
    actionTitle,
    authorizationDescription,
    type Phase,
    type ProtectionChoice,
} from './authorization';

type ActionHeadingProps = {
    action: ActionModel | undefined;
    phase: Phase;
    method: 'PRF' | 'Password' | undefined;
    choice: ProtectionChoice | null;
};

export default function ActionHeading({
    action,
    phase,
    method,
    choice,
}: ActionHeadingProps) {
    const reduce = useReducedMotion();
    const isReceiving = action?.operation === 'sync-receive';
    const isProtectingVault = isReceiving && phase === 'authorize';
    const title = isProtectingVault
        ? 'Protect your vault'
        : actionTitle(action);
    const description = authorizationDescription(
        phase,
        isProtectingVault,
        choice
    );
    const MethodIcon = method === 'PRF' ? MdFingerprint : MdLockOutline;
    const AuthorizationIcon =
        phase === 'done'
            ? MdCheckCircleOutline
            : phase === 'error'
              ? MdErrorOutline
              : MethodIcon;

    return (
        <div className="mb-5 flex items-start gap-3">
            <motion.span
                key={phase}
                className={`grid size-11 flex-[0_0_44px] place-items-center rounded-xl border ${phase === 'done' ? 'border-[color-mix(in_srgb,var(--color-fg-success)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-fg-success)_8%,var(--color-surface))] text-fg-success' : phase === 'error' ? 'border-border bg-[color-mix(in_srgb,var(--color-fg-danger)_6%,var(--color-surface))] text-fg-danger' : 'border-border bg-surface-subtle text-fg-brand'}`}
                aria-hidden="true"
                initial={reduce ? false : { scale: 0.88 }}
                animate={{ scale: 1 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
            >
                <AuthorizationIcon size={24} />
            </motion.span>
            <div>
                <h2
                    className="text-[1.375rem] leading-[1.4]"
                    id="action-title"
                >
                    {title}
                </h2>
                <p className="mt-1.5 text-[0.8125rem] leading-[1.6] text-fg-muted">
                    {description}
                </p>
            </div>
        </div>
    );
}
