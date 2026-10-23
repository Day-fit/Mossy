import { MdErrorOutline, MdCheckCircleOutline } from 'react-icons/md';
import type { Phase } from './authorization';

type ActionStatusProps = {
    phase: Phase;
    message: string;
};

export default function ActionStatus({ phase, message }: ActionStatusProps) {
    return (
        <div
            role={phase === 'done' ? 'status' : 'alert'}
            className={`status ${phase === 'done' ? 'success' : 'error'}`}
        >
            {phase !== 'done' ? (
                <MdErrorOutline size={18} aria-hidden="true" />
            ) : (
                <MdCheckCircleOutline size={18} aria-hidden="true" />
            )}
            <span>{message}</span>
        </div>
    );
}
