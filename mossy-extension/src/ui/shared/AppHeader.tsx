import type { ReactNode } from 'react';

export default function AppHeader({ children }: { children?: ReactNode }) {
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
