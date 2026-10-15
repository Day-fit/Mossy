import NavTab from './NavTab.tsx';
import Button from '../shared/Button.tsx';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth.ts';
import AccountMenu from './AccountMenu.tsx';
import { useDeviceManagementStore } from '../../store/deviceManagementStore.ts';

const menuVariants: Variants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
        opacity: 1,
        height: 'auto',
        transition: {
            duration: 0.3,
            ease: 'easeOut' as const,
            when: 'beforeChildren',
            staggerChildren: 0.08,
        },
    },
    exit: {
        opacity: 0,
        height: 0,
        transition: { duration: 0.2, ease: 'easeIn' as const },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

const navItems = [
    { name: 'Dashboard', url: '/dashboard', requiresAuthentication: true },
    { name: 'Passwords', url: '/passwords', requiresAuthentication: true },
    { name: 'Vaults', url: '/vaults', requiresAuthentication: true },
    { name: 'Devices', url: '/devices', requiresAuthentication: true },
];

function Nav() {
    const navigate = useNavigate();
    const { isAuthenticated, userDetails, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const enrollmentCount = useDeviceManagementStore(
        (state) => state.enrollments.length
    );

    const toggleMenu = () => setIsOpen((prev) => !prev);
    const closeMenu = () => setIsOpen(false);

    const signOut = async () => {
        if (signingOut) return;
        setSigningOut(true);
        try {
            await logout();
        } catch {
            // The existing logout flow clears local credentials even if the request fails.
        } finally {
            closeMenu();
            setSigningOut(false);
            navigate('/', { replace: true });
        }
    };

    return (
        <>
            <nav className="grid shrink-0 grid-cols-[1fr_auto_1fr] grid-rows-1 items-center w-full h-20 border-b border-b-border sticky top-0 bg-surface z-50">
                <Link
                    to="/"
                    aria-label="Mossy home"
                    onClick={closeMenu}
                    className="col-start-1 justify-self-start self-stretch rounded-sm"
                >
                    <img
                        className="h-full max-w-none p-2 object-contain cursor-pointer"
                        alt="mossy-logo"
                        src="/mossy_logo.png"
                    />
                </Link>

                <div className="hidden lg:flex gap-10 items-center h-full">
                    {navItems.map((item) => (
                        <NavTab
                            key={item.url}
                            name={item.name}
                            url={item.url}
                            requiresAuthentication={item.requiresAuthentication}
                            badgeCount={
                                item.url === '/devices' ? enrollmentCount : 0
                            }
                        />
                    ))}
                </div>

                <div className={'hidden lg:flex justify-self-end mr-4'}>
                    {!isAuthenticated ? (
                        <div className="flex items-center gap-2">
                            <Link
                                to="/settings"
                                className="inline-flex min-h-11 items-center rounded-sm px-3 text-sm text-fg-secondary hover:text-fg-brand"
                            >
                                Settings
                            </Link>
                            <Button onClick={() => navigate('/register')}>
                                Sign Up
                            </Button>
                            <Button
                                variant={'outline'}
                                onClick={() => navigate('/login')}
                            >
                                Sign In
                            </Button>
                        </div>
                    ) : (
                        <AccountMenu
                            username={userDetails?.username}
                            signingOut={signingOut}
                            onSignOut={signOut}
                        />
                    )}
                </div>

                <button
                    className="lg:hidden mr-4 flex flex-col col-start-3 justify-self-end justify-center items-center w-10 h-10 cursor-pointer"
                    onClick={toggleMenu}
                    type="button"
                    aria-label={isOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? 'mobile-navigation' : undefined}
                >
                    <motion.span
                        animate={
                            isOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }
                        }
                        transition={{ duration: 0.2 }}
                        className="w-6 h-0.5 bg-fg-secondary mb-1"
                    />
                    <motion.span
                        animate={
                            isOpen
                                ? { opacity: 0, scaleX: 0 }
                                : { opacity: 1, scaleX: 1 }
                        }
                        transition={{ duration: 0.2 }}
                        className="w-6 h-0.5 bg-fg-secondary mb-1"
                    />
                    <motion.span
                        animate={
                            isOpen
                                ? { rotate: -45, y: -6 }
                                : { rotate: 0, y: 0 }
                        }
                        transition={{ duration: 0.2 }}
                        className="w-6 h-0.5 bg-fg-secondary"
                    />
                </button>
            </nav>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="mobile-menu"
                        id="mobile-navigation"
                        variants={menuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="lg:hidden shrink-0 overflow-hidden bg-surface border-b-2 border-border sticky top-20 z-40 w-full"
                    >
                        <div className="flex flex-col items-start px-6 py-4 gap-4">
                            {navItems.map((item) => (
                                <motion.div
                                    key={item.url}
                                    variants={itemVariants}
                                    className="w-full"
                                >
                                    <NavTab
                                        name={item.name}
                                        url={item.url}
                                        requiresAuthentication={
                                            item.requiresAuthentication
                                        }
                                        badgeCount={
                                            item.url === '/devices'
                                                ? enrollmentCount
                                                : 0
                                        }
                                        onClick={closeMenu}
                                    />
                                </motion.div>
                            ))}
                            <motion.div
                                variants={itemVariants}
                                className="w-full"
                            >
                                <NavTab
                                    name="Settings"
                                    url="/settings"
                                    requiresAuthentication={false}
                                    onClick={closeMenu}
                                />
                            </motion.div>
                            {isAuthenticated && (
                                <motion.div
                                    variants={itemVariants}
                                    className="w-full border-t border-border pt-3"
                                >
                                    {userDetails?.username && (
                                        <p className="mb-2 px-5 text-sm text-fg-muted">
                                            {userDetails.username}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void signOut()}
                                        disabled={signingOut}
                                        aria-busy={signingOut}
                                        className="min-h-11 w-full cursor-pointer rounded-sm px-5 text-left text-sm font-semibold text-fg-danger hover:bg-danger/5 disabled:cursor-wait"
                                    >
                                        {signingOut
                                            ? 'Signing out…'
                                            : 'Sign out'}
                                    </button>
                                </motion.div>
                            )}
                            {!isAuthenticated && (
                                <motion.div
                                    variants={itemVariants}
                                    className="flex flex-col gap-3 w-full pt-2"
                                >
                                    <Button
                                        onClick={() => {
                                            navigate('/register');
                                            closeMenu();
                                        }}
                                    >
                                        Sign Up
                                    </Button>
                                    <Button
                                        variant={'outline'}
                                        onClick={() => {
                                            navigate('/login');
                                            closeMenu();
                                        }}
                                    >
                                        Sign In
                                    </Button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default Nav;
