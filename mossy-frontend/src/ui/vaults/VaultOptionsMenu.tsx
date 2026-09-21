import { useEffect, useRef, useState } from 'react';
import Button from '../shared/Button.tsx';

type VaultOptionsMenuProps = {
    onRename: () => void;
    onDelete: () => void;
    onCopyVaultId: () => void;
};

export default function VaultOptionsMenu({
    onRename,
    onDelete,
    onCopyVaultId,
}: VaultOptionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    const closeAndRun = (callback: () => void) => {
        callback();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={rootRef}>
            <Button
                variant="ghost"
                type="button"
                padding="none"
                aria-label="options"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                ⋯
            </Button>

            {isOpen ? (
                <div className="absolute right-0 z-20 mt-2 min-w-40 rounded-md border border-border bg-surface-card p-1 shadow-popover">
                    <button
                        type="button"
                        className="type-button-sm block w-full rounded px-3 py-2 text-left hover:bg-surface-muted"
                        onClick={() => closeAndRun(onCopyVaultId)}
                    >
                        Copy vault ID
                    </button>
                    <button
                        type="button"
                        className="type-button-sm block w-full rounded px-3 py-2 text-left hover:bg-surface-muted"
                        onClick={() => closeAndRun(onRename)}
                    >
                        Rename vault
                    </button>
                    <button
                        type="button"
                        className="type-button-sm block w-full rounded px-3 py-2 text-left text-danger hover:bg-danger-subtle"
                        onClick={() => closeAndRun(onDelete)}
                    >
                        Delete vault
                    </button>
                </div>
            ) : null}
        </div>
    );
}
