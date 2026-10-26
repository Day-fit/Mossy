import type { ReactNode } from 'react';
import { MdVerifiedUser } from 'react-icons/md';

export default function SecurityNotice({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <p
            className={`flex items-start gap-2 px-1 text-[0.6875rem] leading-[1.6] text-fg-muted ${className}`}
        >
            <MdVerifiedUser
                className="mt-px shrink-0 text-fg-brand"
                size={17}
                aria-hidden="true"
            />
            <span>{children}</span>
        </p>
    );
}
