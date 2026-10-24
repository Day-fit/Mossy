import type { ReactNode } from 'react';
import { MdLockOutline } from 'react-icons/md';
import type { IconType } from 'react-icons';

export default function EmptyState({
    title,
    children,
    icon: Icon = MdLockOutline,
}: {
    title: string;
    children: ReactNode;
    icon?: IconType;
}) {
    return (
        <div className="empty">
            <Icon size={25} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{children}</p>
        </div>
    );
}
