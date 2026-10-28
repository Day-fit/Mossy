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
            <dl className="mb-5 flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3.5 [&>div]:grid [&>div]:grid-cols-[86px_minmax(0,1fr)] [&>div]:items-baseline [&>div]:gap-2.5 max-[400px]:[&>div]:grid-cols-[70px_minmax(0,1fr)] [&_dt]:text-xs [&_dt]:text-fg-muted [&_dd]:m-0 [&_dd]:text-[0.8125rem] [&_dd]:text-fg-secondary [&_dd]:[overflow-wrap:anywhere]">
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
                    <dd className="block [overflow-wrap:anywhere]">
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
                        className="-mt-2 mb-[18px]"
                    />
                )}
        </>
    );
}
