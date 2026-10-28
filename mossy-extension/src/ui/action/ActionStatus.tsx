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
            size={phase === 'done' ? 'large' : 'default'}
            className="mt-[18px]"
        >
            {message}
        </Feedback>
    );
}
