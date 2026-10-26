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
        <div className="flex flex-col items-center gap-[9px] px-3 py-5 text-center">
            <Icon
                className="mb-1 box-content rounded-[14px] bg-surface-subtle p-[13px] text-fg-brand"
                size={25}
                aria-hidden="true"
            />
            <h3 className="text-[0.9375rem] leading-[1.4]">{title}</h3>
            <p className="max-w-[32ch] text-[0.8125rem] leading-[1.6] text-fg-muted">
                {children}
            </p>
        </div>
    );
}
