import type { ReactNode } from 'react';

export default function LoadingState({ children }: { children: ReactNode }) {
    return (
        <div className="loading-state" role="status">
            <span className="skeleton" aria-hidden="true" />
            <span className="skeleton" aria-hidden="true" />
            <p>{children}</p>
        </div>
    );
}
