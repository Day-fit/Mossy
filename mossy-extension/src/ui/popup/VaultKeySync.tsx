import { Button } from '@mossy/ui';
import { MdClose, MdDownload, MdUpload } from 'react-icons/md';
import type { RunPopupAction } from './types';

type VaultKeySyncProps = {
    loading: boolean;
    selected: string | undefined;
    vaultName: string | undefined;
    action: RunPopupAction;
    onClose: () => void;
};

export default function VaultKeySync({
    loading,
    selected,
    vaultName,
    action,
    onClose,
}: VaultKeySyncProps) {
    return (
        <section
            id="vault-key-sync"
            className="panel sync-panel"
            aria-labelledby="sync-heading"
        >
            <div className="section-heading">
                <h2 id="sync-heading" tabIndex={-1}>
                    Sync a vault key
                </h2>
                <button
                    type="button"
                    className="icon"
                    aria-label="Close key sync"
                    onClick={onClose}
                >
                    <MdClose aria-hidden="true" />
                </button>
            </div>
            <p className="sync-vault">
                {vaultName ? (
                    <>
                        Vault: <strong>{vaultName}</strong>
                    </>
                ) : (
                    'Select a vault from the password list to continue.'
                )}
            </p>
            <div className="intro">
                <p className="muted">
                    Receive from an approved device or enter its receiving code
                    to send this vault key.
                </p>
            </div>
            <Button
                padding="small"
                variant="outline"
                disabled={loading || !selected}
                onClick={() => void action('sync-receive')}
                className="sync-receive"
            >
                <MdDownload size={18} aria-hidden="true" />
                Receive vault key
            </Button>
            <form
                onSubmit={(event) => {
                    event.preventDefault();

                    const code = String(
                        new FormData(event.currentTarget).get('code')
                    ).toUpperCase();
                    void action('sync-send', undefined, undefined, code);
                }}
            >
                <strong className="sync-divider-label">
                    Send to another device
                </strong>
                <p className="muted">
                    Enter the code shown on the receiving device.
                </p>
                <label htmlFor="code">Receiving code</label>
                <input
                    id="code"
                    name="code"
                    minLength={6}
                    maxLength={6}
                    pattern="[A-Za-z0-9]{6}"
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="ABC123"
                />
                <Button
                    type="submit"
                    padding="small"
                    disabled={loading || !selected}
                >
                    <MdUpload size={18} aria-hidden="true" />
                    Authorize send
                </Button>
            </form>
        </section>
    );
}
