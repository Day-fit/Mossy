import {
    MdFingerprint,
    MdLockOutline,
    MdCheckCircleOutline,
    MdErrorOutline,
} from 'react-icons/md';
import type { Action as ActionModel } from '../../types/models';
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
            <span className="auth-symbol" aria-hidden="true">
                <AuthorizationIcon size={24} />
            </span>
            <div>
                <h2 id="action-title">{title}</h2>
                <p>{description}</p>
            </div>
        </div>
    );
}
