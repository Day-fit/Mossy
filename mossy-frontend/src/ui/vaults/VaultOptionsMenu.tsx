import {useEffect, useRef, useState} from "react";

type VaultOptionsMenuProps = {
    onRename: () => void;
    onDelete: () => void;
    onCopyVaultId: () => void;
};

export default function VaultOptionsMenu({onRename, onDelete, onCopyVaultId}: VaultOptionsMenuProps) {
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

        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, [isOpen]);

    const closeAndRun = (callback: () => void) => {
        callback();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={rootRef}>
            <button
                type="button"
                className="rounded-md border border-gray-200 px-2 py-1 text-sm hover:bg-gray-100"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                ⋯
            </button>

            {isOpen ? (
                <div className="absolute right-0 z-20 mt-2 min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                    <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => closeAndRun(onCopyVaultId)}
                    >
                        Copy vault ID
                    </button>
                    <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => closeAndRun(onRename)}
                    >
                        Rename vault
                    </button>
                    <button
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => closeAndRun(onDelete)}
                    >
                        Delete vault
                    </button>
                </div>
            ) : null}
        </div>
    );
}
