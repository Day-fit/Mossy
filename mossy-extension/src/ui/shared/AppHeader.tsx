import type { ReactNode } from 'react';

export default function AppHeader({
    children,
    onHome,
    className = 'px-5',
}: {
    children?: ReactNode;
    onHome: () => void;
    className?: string;
}) {
    return (
        <header
            className={`flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface py-2 ${className}`}
        >
            <h1 className="flex items-center" aria-label="Mossy">
                <a
                    href="/popup.html"
                    className="text-fg-brand underline-offset-3 hover:text-fg-brand-hover hover:underline inline-flex rounded-[5px]"
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
                        className="h-12 w-[106px] object-contain"
                        src="/mossy_logo.png"
                        width="106"
                        height="48"
                        alt="Mossy"
                    />
                </a>
            </h1>
            <div className="flex items-center gap-2">{children}</div>
        </header>
    );
}
