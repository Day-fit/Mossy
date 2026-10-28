import type { ReactNode } from 'react';

export default function LoadingState({ children }: { children: ReactNode }) {
    return (
        <div className="py-5" role="status">
            <span
                className="mt-2.5 block h-3.5 rounded-[5px] bg-surface-muted motion-safe:animate-pulse"
                aria-hidden="true"
            />
            <span
                className="mt-2.5 block h-3.5 w-[65%] rounded-[5px] bg-surface-muted motion-safe:animate-pulse motion-safe:[animation-delay:150ms]"
                aria-hidden="true"
            />
            <p className="mt-4 text-[0.8125rem] leading-[1.6] text-fg-muted">
                {children}
            </p>
        </div>
    );
}
