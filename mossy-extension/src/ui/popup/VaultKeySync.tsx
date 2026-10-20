import { Button } from '@mossy/ui';
import type { RunPopupAction } from './types';

type VaultKeySyncProps = {
    loading: boolean;
    selected: string | undefined;
    action: RunPopupAction;
};

export default function VaultKeySync({
    loading,
    selected,
    action,
}: VaultKeySyncProps) {
    return (
        <section
            id="vault-key-sync"
            className="panel sync-panel"
            aria-labelledby="sync-heading"
        >
            <div className="intro">
                <h2 id="sync-heading" tabIndex={-1}>
                    Sync a vault key
                </h2>
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
            >
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
                <label htmlFor="code">Receiving code</label>
                <input
                    id="code"
                    name="code"
                    minLength={6}
                    maxLength={6}
                    pattern="[A-Za-z0-9]{6}"
                    required
                    autoComplete="off"
                />
                <Button
                    type="submit"
                    padding="small"
                    disabled={loading || !selected}
                >
                    Authorize send
                </Button>
            </form>
        </section>
    );
}
