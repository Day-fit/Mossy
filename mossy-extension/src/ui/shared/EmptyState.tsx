import type { ReactNode } from 'react';
import { MdLockOutline } from 'react-icons/md';

export default function EmptyState({
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
