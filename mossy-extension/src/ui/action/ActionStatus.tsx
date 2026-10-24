import type { Phase } from './authorization';
import Feedback from '../shared/Feedback';

type ActionStatusProps = {
    phase: Phase;
    message: string;
};

export default function ActionStatus({ phase, message }: ActionStatusProps) {
    return (
        <Feedback
            id="action-feedback"
            tone={phase === 'done' ? 'success' : 'error'}
            className={phase === 'done' ? 'action-success' : ''}
        >
            {message}
        </Feedback>
    );
}
