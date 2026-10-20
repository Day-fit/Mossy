import LoadingState from '../shared/LoadingState';

type ReceivingCodeProps = {
    code: string;
};

export default function ReceivingCode({ code }: ReceivingCodeProps) {
    return (
        <>
            <p>
                Open Sync on the device that holds this vault key and enter this
                code.
            </p>
            {code ? (
                <output className="code" aria-label="Receiving code">
                    {code}
                </output>
            ) : (
                <LoadingState>Creating a receiving code…</LoadingState>
            )}
            <p className="muted">
                Local protection is requested after the transfer is received and
                verified.
            </p>
        </>
    );
}
