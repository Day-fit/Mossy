import type { ReactNode } from 'react';
import { MdVerifiedUser } from 'react-icons/md';

export default function SecurityNotice({ children }: { children: ReactNode }) {
    return (
        <p className="notice">
            <MdVerifiedUser size={17} aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}
