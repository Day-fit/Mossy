import { MdVerifiedUser } from 'react-icons/md';
import AppHeader from './ui/shared/AppHeader';
import LoadingState from './ui/shared/LoadingState';
import SecurityNotice from './ui/shared/SecurityNotice';
import ActionHeading from './ui/action/ActionHeading';
import ActionContext from './ui/action/ActionContext';
import AuthorizationForm from './ui/action/AuthorizationForm';
import ActionStatus from './ui/action/ActionStatus';
import ActionFooter from './ui/action/ActionFooter';
import ReceivingCode from './ui/action/ReceivingCode';
import { useActionSession } from './ui/action/useActionSession';
import { useActionAuthorization } from './ui/action/useActionAuthorization';
import { useTheme } from './theme/useTheme';
import ViewTransition from './ui/shared/ViewTransition';

export default function Action() {
    useTheme();
    const session = useActionSession();
    const {
        action,
        phase,
        method,
        message,
        code,
        password,
        confirmation,
        close,
    } = session;
    const { choice, authorize, selectChoice, vaultName } =
        useActionAuthorization(session);
    const isReceiving = action?.operation === 'sync-receive';

    return (
        <main className="action">
            <AppHeader onHome={() => void session.home()}>
                <MdVerifiedUser
                    size={22}
                    className="field-icon"
                    aria-label="Secure action"
                />
            </AppHeader>
            <div className="page-content">
                <section
                    className="panel action-panel"
                    aria-labelledby="action-title"
                    aria-busy={phase === 'loading' || phase === 'busy'}
                >
                    <ActionHeading
                        action={action}
                        phase={phase}
                        method={method}
                        choice={choice}
                    />
                    {action && (
                        <ActionContext
                            action={action}
                            phase={phase}
                            vaultName={vaultName}
                        />
                    )}
                    <ViewTransition viewKey={phase}>
                        {phase === 'loading' && (
                            <LoadingState>
                                Preparing secure action…
                            </LoadingState>
                        )}
                        {phase === 'waiting' && <ReceivingCode code={code} />}
                        {phase === 'authorize' && (
                            <AuthorizationForm
                                isReceiving={isReceiving}
                                choice={choice}
                                method={method}
                                password={password}
                                confirmation={confirmation}
                                authorize={authorize}
                                selectChoice={selectChoice}
                                error={message}
                            />
                        )}
                        {phase === 'busy' && (
                            <LoadingState>
                                Authorizing and completing this action…
                            </LoadingState>
                        )}
                        {message && (
                            <ActionStatus phase={phase} message={message} />
                        )}
                    </ViewTransition>
                    <ActionFooter
                        phase={phase}
                        method={method}
                        isReceiving={isReceiving}
                        choice={choice}
                        close={close}
                    />
                </section>
                <SecurityNotice>
                    This authorization applies to this action only.
                </SecurityNotice>
            </div>
        </main>
    );
}
