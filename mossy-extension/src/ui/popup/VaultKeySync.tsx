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
            className="min-w-0 rounded-xl border border-border bg-surface shadow-control p-5 max-[400px]:p-4"
            aria-labelledby="sync-heading"
        >
            <div className="mb-2 flex items-center justify-between gap-3">
                <h2
                    className="text-lg leading-[1.4] focus:outline-none"
                    id="sync-heading"
                    tabIndex={-1}
                >
                    Sync a vault key
                </h2>
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] size-[38px] flex-[0_0_38px] rounded-md border border-border bg-surface p-0 text-[19px] text-fg-secondary hover:border-border-strong hover:bg-surface-subtle hover:text-fg-brand aria-expanded:border-fg-brand aria-expanded:bg-surface-subtle aria-expanded:text-fg-brand motion-safe:transition-[transform,background-color,border-color,color] cursor-pointer"
                    aria-label="Close key sync"
                    onClick={onClose}
                >
                    <MdClose aria-hidden="true" />
                </button>
            </div>
            <p className="leading-[1.6] mb-2 text-[0.8125rem] text-fg-muted [overflow-wrap:anywhere]">
                {vaultName ? (
                    <>
                        Vault: <strong>{vaultName}</strong>
                    </>
                ) : (
                    'Select a vault from the password list to continue.'
                )}
            </p>
            <div className="mb-5">
                <p className="leading-[1.6] mt-1.5 text-[0.8125rem] text-fg-muted">
                    Receive from an approved device or enter its receiving code
                    to send this vault key.
                </p>
            </div>
            <Button
                padding="small"
                variant="outline"
                disabled={loading || !selected}
                onClick={() => void action('sync-receive')}
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer w-full"
            >
                <MdDownload size={18} aria-hidden="true" />
                Receive vault key
            </Button>
            <form
                className="mt-5 border-t border-border pt-4"
                onSubmit={(event) => {
                    event.preventDefault();

                    const code = String(
                        new FormData(event.currentTarget).get('code')
                    ).toUpperCase();
                    void action('sync-send', undefined, undefined, code);
                }}
            >
                <strong className="mb-2 block text-sm">
                    Send to another device
                </strong>
                <p className="leading-[1.6] text-xs text-fg-muted">
                    Enter the code shown on the receiving device.
                </p>
                <label
                    className="mt-4 mb-[7px] block text-xs leading-normal font-semibold text-fg-secondary"
                    htmlFor="code"
                >
                    Receiving code
                </label>
                <input
                    className="block min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm leading-normal text-fg-primary placeholder:text-fg-subtle placeholder:opacity-100 focus-visible:border-fg-brand focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-fg-danger font-heading tracking-[5px] uppercase"
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
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer mt-3 w-full"
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
