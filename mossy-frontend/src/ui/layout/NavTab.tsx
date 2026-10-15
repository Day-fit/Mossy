import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth.ts';
import type { ReactNode } from 'react';

interface NavTabProps {
    name: string;
    url: string;
    requiresAuthentication: boolean;
    onClick?: () => void;
    badgeCount?: number;
    mobile?: boolean;
    icon?: ReactNode;
}

const MotionNavLink = motion.create(NavLink);

function NavTab({
    name,
    url,
    requiresAuthentication,
    onClick,
    badgeCount = 0,
    mobile = false,
    icon,
}: NavTabProps) {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated !== true && requiresAuthentication) return null;

    if (mobile) {
        return (
            <NavLink
                to={url}
                onClick={onClick}
                className={({ isActive }) =>
                    `flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold ${isActive ? 'bg-brand/10 text-fg-brand' : 'text-fg-secondary hover:bg-surface-subtle'}`
                }
            >
                {icon}
                <span>{name}</span>
                {badgeCount > 0 && (
                    <span className="ml-auto text-xs text-fg-warning">
                        {badgeCount} pending
                    </span>
                )}
            </NavLink>
        );
    }

    return (
        (isAuthenticated === true || !requiresAuthentication) && (
            <section>
                <MotionNavLink
                    to={url}
                    onClick={onClick}
                    className="flex items-center justify-center h-full px-5"
                >
                    {({ isActive }) => (
                        <div className={'flex flex-col'}>
                            <h6>{name}</h6>
                            {badgeCount > 0 ? (
                                <span className="text-center text-xs font-semibold text-fg-warning">
                                    {badgeCount} pending
                                </span>
                            ) : null}
                            {isActive && (
                                <motion.div
                                    className="border-b-2 border-fg-brand"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: 'easeOut',
                                    }}
                                    style={{ transformOrigin: 'right' }}
                                />
                            )}
                        </div>
                    )}
                </MotionNavLink>
            </section>
        )
    );
}

export default NavTab;
