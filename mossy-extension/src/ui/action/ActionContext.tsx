import type { Action as ActionModel } from '../../types/models';
import type { Phase } from './authorization';
import Countdown from '../shared/Countdown';

type ActionContextProps = {
    action: ActionModel;
    phase: Phase;
    vaultName: string | undefined;
};

export default function ActionContext({
    action,
    phase,
    vaultName,
}: ActionContextProps) {
    return (
        <>
            <dl className="action-context">
                <div>
                    <dt>Vault</dt>
                    <dd>{vaultName ?? action.scope.vaultId}</dd>
                </div>
                <div>
                    <dt>
                        {action.entry || action.candidateOrigin
                            ? 'Website'
                            : 'Mossy instance'}
                    </dt>
                    <dd className="site">
                        {action.candidateOrigin ??
                            action.entry?.address ??
                            new URL(action.scope.instance).hostname}
                    </dd>
                </div>
                {(action.entry?.identifier || action.candidateIdentifier) && (
                    <div>
                        <dt>Username</dt>
                        <dd>
                            {action.entry?.identifier ??
                                action.candidateIdentifier}
                        </dd>
                    </div>
                )}
            </dl>
            {action.candidateDeadline &&
                phase !== 'done' &&
                phase !== 'error' && (
                    <Countdown
                        deadline={action.candidateDeadline}
                        label="Save expires in"
                    />
                )}
        </>
    );
}
