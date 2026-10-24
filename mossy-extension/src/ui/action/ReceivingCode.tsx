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
                    className="code"
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
                    className="copy-code"
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
            <ol className="sync-instructions">
                <li>
                    Open <strong>Sync</strong> on the device that already has
                    this vault key.
                </li>
                <li>
                    Enter the six-character code above and authorize the
                    transfer.
                </li>
            </ol>
            <p className="muted">
                You’ll choose local protection after the transfer.
            </p>
            {error && <Feedback>{error}</Feedback>}
        </>
    );
}
