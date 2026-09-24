import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth.ts';

interface NavTabProps {
    name: string;
    url: string;
    requiresAuthentication: boolean;
    onClick?: () => void;
    badgeCount?: number;
}

const MotionNavLink = motion.create(NavLink);

function NavTab({
    name,
    url,
    requiresAuthentication,
    onClick,
    badgeCount = 0,
}: NavTabProps) {
    const { isAuthenticated } = useAuth();

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
                                <span className="text-center text-xs font-semibold text-warning">
                                    {badgeCount} pending
                                </span>
                            ) : null}
                            {isActive && (
                                <motion.div
                                    className="border-b-2 border-brand"
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
