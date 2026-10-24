import type { ReactNode } from 'react';

export default function AppHeader({
    children,
    onHome,
}: {
    children?: ReactNode;
    onHome: () => void;
}) {
    return (
        <header className="app-header">
            <h1 className="brand" aria-label="Mossy">
                <a
                    href="/popup.html"
                    className="brand-home"
                    aria-label="Mossy home"
                    onClick={(event) => {
                        if (
                            event.ctrlKey ||
                            event.metaKey ||
                            event.shiftKey ||
                            event.altKey
                        )
                            return;
                        event.preventDefault();
                        onHome();
                    }}
                >
                    <img
                        src="/mossy_logo.png"
                        width="106"
                        height="48"
                        alt="Mossy"
                    />
                </a>
            </h1>
            <div className="header-actions">{children}</div>
        </header>
    );
}
