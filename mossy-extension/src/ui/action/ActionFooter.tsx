import { Button } from '@mossy/ui';
import {
    protectionLabels,
    type Phase,
    type ProtectionChoice,
} from './authorization';

type ActionFooterProps = {
    phase: Phase;
    method: 'PRF' | 'Password' | undefined;
    isReceiving: boolean;
    choice: ProtectionChoice | null;
    close: () => void;
};

export default function ActionFooter({
    phase,
    method,
    isReceiving,
    choice,
    close,
}: ActionFooterProps) {
    const authorizeLabel = isReceiving
        ? protectionLabels[choice ?? 'use-password']
        : method === 'PRF'
          ? 'Authorize with passkey'
          : 'Authorize action';
    return (
        <div className="action-footer">
            <Button variant="outline" padding="medium" onClick={close}>
                {phase === 'done' ? 'Close' : 'Cancel'}
            </Button>
            {phase === 'authorize' && method && (
                <Button type="submit" form="authorize-form" padding="medium">
                    {authorizeLabel}
                </Button>
            )}
        </div>
    );
}
