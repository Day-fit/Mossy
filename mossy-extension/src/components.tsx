import type { ReactNode } from 'react';
import { MdLockOutline, MdVerifiedUser } from 'react-icons/md';

export function AppHeader({ children }: { children?: ReactNode }) {
    return (
        <header className="app-header">
            <h1 className="brand">
                <img
                    src="/mossy_logo.png"
                    width="106"
                    height="48"
                    alt="Mossy"
                />
            </h1>
            <div className="header-actions">{children}</div>
        </header>
    );
}

export function SecurityNotice({ children }: { children: ReactNode }) {
    return (
        <p className="notice">
            <MdVerifiedUser size={17} aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}

export function EmptyState({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="empty">
            <MdLockOutline size={25} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{children}</p>
        </div>
    );
}

export function LoadingState({ children }: { children: ReactNode }) {
    return (
        <div className="loading-state" role="status">
            <span className="skeleton" aria-hidden="true" />
            <span className="skeleton" aria-hidden="true" />
            <p>{children}</p>
        </div>
    );
}
