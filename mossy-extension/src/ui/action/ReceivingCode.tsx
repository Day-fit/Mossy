import LoadingState from '../shared/LoadingState';
import { useState } from 'react';
import { Button } from '@mossy/ui';
import { MdCheck, MdContentCopy } from 'react-icons/md';
import Feedback from '../shared/Feedback';

type ReceivingCodeProps = {
    code: string;
};

export default function ReceivingCode({ code }: ReceivingCodeProps) {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setError('');
        } catch {
            setError(
                'Could not copy the code. You can enter it manually on the other device.'
            );
        }
    };
    return (
        <>
            {code ? (
                <output
                    className="mt-[18px] mb-3 block rounded-[10px] border border-[color-mix(in_srgb,var(--color-fg-brand)_40%,var(--color-border))] bg-surface-subtle p-3 text-center font-heading text-[2rem] font-medium tracking-[8px] text-fg-brand tabular-nums"
                    aria-label="Receiving code"
                    aria-live="polite"
                >
                    {code}
                </output>
            ) : (
                <LoadingState>Creating a receiving code…</LoadingState>
            )}
            {code && (
                <Button
                    type="button"
                    variant="outline"
                    padding="medium"
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer mb-4 w-full"
                    onClick={() => void copy()}
                    aria-label="Copy receiving code"
                >
                    {copied ? (
                        <MdCheck size={17} aria-hidden="true" />
                    ) : (
                        <MdContentCopy size={17} aria-hidden="true" />
                    )}
                    {copied ? 'Code copied' : 'Copy code'}
                </Button>
            )}
            <ol className="my-3 list-decimal pl-5 text-[0.8125rem] leading-[1.7] text-fg-secondary [&>li+li]:mt-1.5">
                <li>
                    Open <strong>Sync</strong> on the device that already has
                    this vault key.
                </li>
                <li>
                    Enter the six-character code above and authorize the
                    transfer.
                </li>
            </ol>
            <p className="leading-[1.6] text-xs text-fg-muted">
                You’ll choose local protection after the transfer.
            </p>
            {error && <Feedback className="mt-[18px]">{error}</Feedback>}
        </>
    );
}
