import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';

export function AuthTransition({
    transitionKey,
    children,
    flip = true,
}: {
    transitionKey: string;
    children: ReactNode;
    flip?: boolean;
}) {
    const reducedMotion = useReducedMotion();
    const [phase, setPhase] = useState({
        current: transitionKey,
        changed: false,
    });
    if (phase.current !== transitionKey) {
        setPhase({ current: transitionKey, changed: true });
    }
    return (
        <div className="w-full perspective-distant">
            <AnimatePresence mode="wait" custom={flip}>
                <motion.div
                    key={transitionKey}
                    className="transform-3d backface-hidden"
                    initial={
                        flip && phase.changed && !reducedMotion
                            ? { rotateY: -90, scale: 0.95 }
                            : false
                    }
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    exit="exit"
                    variants={{
                        exit: (shouldFlip: boolean) => ({
                            rotateY: shouldFlip && !reducedMotion ? 90 : 0,
                            scale: shouldFlip && !reducedMotion ? 0.95 : 1,
                            transition: {
                                duration:
                                    shouldFlip && !reducedMotion ? 0.2 : 0,
                            },
                        }),
                    }}
                    transition={{
                        duration: reducedMotion ? 0 : 0.2,
                        ease: 'easeOut',
                    }}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

export default function AuthRoutes() {
    const location = useLocation();
    const outlet = useOutlet();
    const [route, setRoute] = useState({
        current: location.pathname,
        previous: '',
    });
    if (route.current !== location.pathname) {
        setRoute({ current: location.pathname, previous: route.current });
    }
    const flip =
        route.previous !== '' &&
        (route.previous === '/verify-email' ||
            location.pathname === '/verify-email');
    return (
        <div className="w-full overflow-x-clip">
            <AuthTransition transitionKey={location.pathname} flip={flip}>
                {outlet}
            </AuthTransition>
        </div>
    );
}
