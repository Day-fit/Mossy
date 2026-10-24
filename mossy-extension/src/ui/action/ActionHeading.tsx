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
        <div className="auth-heading">
            <motion.span
                key={phase}
                className={`auth-symbol auth-symbol-${phase}`}
                aria-hidden="true"
                initial={reduce ? false : { scale: 0.88 }}
                animate={{ scale: 1 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
            >
                <AuthorizationIcon size={24} />
            </motion.span>
            <div>
                <h2 id="action-title">{title}</h2>
                <p>{description}</p>
            </div>
        </div>
    );
}
