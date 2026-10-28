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
        <div className="mt-6 flex justify-end gap-2.5 border-t border-border pt-5 max-[400px]:flex-wrap [&>button]:flex-1">
            <Button
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer"
                variant="outline"
                padding="medium"
                onClick={close}
            >
                {phase === 'done' || phase === 'error' ? 'Close' : 'Cancel'}
            </Button>
            {phase === 'authorize' && method && (
                <Button
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer"
                    type="submit"
                    form="authorize-form"
                    padding="medium"
                >
                    {authorizeLabel}
                </Button>
            )}
        </div>
    );
}
