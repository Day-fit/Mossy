import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    MdExpandMore,
    MdLogout,
    MdPersonOutline,
    MdSettings,
} from 'react-icons/md';

type AccountMenuProps = {
    username?: string;
    signingOut: boolean;
    onSignOut: () => Promise<void>;
};

export default function AccountMenu({
    username,
    signingOut,
    onSignOut,
}: AccountMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const settingsRef = useRef<HTMLAnchorElement>(null);
    const signOutRef = useRef<HTMLButtonElement>(null);
    const openAtEnd = useRef(false);
    const menuId = useId();
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        if (!isOpen) return;
        const firstItem =
            openAtEnd.current && !signingOut
                ? signOutRef.current
                : settingsRef.current;
        firstItem?.focus();
        const dismiss = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !rootRef.current?.contains(event.target)
            )
                setIsOpen(false);
        };
        document.addEventListener('pointerdown', dismiss);
        return () => document.removeEventListener('pointerdown', dismiss);
    }, [isOpen, signingOut]);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
            return;
        if (!isOpen) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openAtEnd.current = event.key === 'ArrowUp';
                setIsOpen(true);
            }
            return;
        }
        event.preventDefault();
        const items = [settingsRef.current, signOutRef.current].filter(
            (item) => item && !item.hasAttribute('disabled')
        );
        const currentIndex = items.findIndex(
            (item) => item === document.activeElement
        );
        const nextIndex =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (currentIndex +
                        (event.key === 'ArrowDown' ? 1 : -1) +
                        items.length) %
                    items.length;
        items[nextIndex]?.focus();
    };

    return (
        <div
            ref={rootRef}
            className="relative"
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                    setIsOpen(false);
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label="Account menu"
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                aria-haspopup="menu"
                onClick={() => {
                    openAtEnd.current = false;
                    setIsOpen((open) => !open);
                }}
                className="flex h-11 cursor-pointer items-center gap-1 rounded-md border border-border-strong px-2 text-fg-secondary hover:bg-surface-subtle"
            >
                <MdPersonOutline className="h-7 w-7" aria-hidden="true" />
                <MdExpandMore className="h-4 w-4" aria-hidden="true" />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id={menuId}
                        role="menu"
                        aria-label="Account"
                        initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
                        transition={{ duration: reducedMotion ? 0 : 0.15 }}
                        className="absolute right-0 top-full z-50 mt-2 w-60 rounded-md border border-border bg-surface p-2 shadow-card"
                    >
                        <p
                            role="presentation"
                            className="truncate border-b border-border px-3 py-3 text-sm text-fg-muted"
                            title={username}
                        >
                            {username || 'Your account'}
                        </p>
                        <Link
                            ref={settingsRef}
                            role="menuitem"
                            tabIndex={-1}
                            to="/settings"
                            onClick={() => setIsOpen(false)}
                            className="mt-1 flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm text-fg-secondary hover:bg-surface-subtle"
                        >
                            <MdSettings aria-hidden="true" /> Settings
                        </Link>
                        <button
                            ref={signOutRef}
                            role="menuitem"
                            tabIndex={-1}
                            type="button"
                            disabled={signingOut}
                            aria-busy={signingOut}
                            onClick={() => void onSignOut()}
                            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-3 text-left text-sm text-fg-danger hover:bg-danger/5 disabled:cursor-wait"
                        >
                            <MdLogout aria-hidden="true" />{' '}
                            {signingOut ? 'Signing out…' : 'Sign out'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
