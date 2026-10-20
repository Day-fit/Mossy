import type { Action as ActionModel } from '../../types/models';
import type { Phase } from './authorization';

type ActionContextProps = {
    action: ActionModel;
    phase: Phase;
    now: number;
};

export default function ActionContext({
    action,
    phase,
    now,
}: ActionContextProps) {
    return (
        <>
            <div className="action-context">
                <p className="site">
                    {action.candidateOrigin ??
                        action.entry?.address ??
                        new URL(action.scope.instance).hostname}
                </p>
                {(action.entry?.identifier || action.candidateIdentifier) && (
                    <p>
                        {action.entry?.identifier ?? action.candidateIdentifier}
                    </p>
                )}
            </div>
            {action.candidateDeadline &&
                phase !== 'done' &&
                phase !== 'error' && (
                    <p className="expiry" role="timer">
                        Save expires in{' '}
                        {Math.max(
                            0,
                            Math.ceil((action.candidateDeadline - now) / 1000)
                        )}{' '}
                        seconds
                    </p>
                )}
        </>
    );
}
