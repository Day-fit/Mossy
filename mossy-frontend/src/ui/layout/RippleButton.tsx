import {
    motion,
    AnimatePresence,
    useMotionValue,
    useSpring,
    useTransform
} from "framer-motion";
import {
    useState,
    useRef,
    type MouseEvent,
    type ReactNode
} from "react";

interface Ripple {
    id: number;
    x: number;
    y: number;
    size: number;
}

interface RippleButtonProps {
    children: ReactNode;
    className?: string;
    rippleColor?: string;
    onClick?: Function
}

export default function RippleButton({
    className,
    children,
    rippleColor = "rgba(255, 255, 255, 0.6)",
    onClick
}: RippleButtonProps) {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const ref = useRef<HTMLButtonElement>(null);

    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    const rotateX = useSpring(
        useTransform(my, [-0.5, 0.5], [18, -18]),
        {stiffness: 300, damping: 25, mass: 0.5}
    );

    const rotateY = useSpring(
        useTransform(mx, [-0.5, 0.5], [-18, 18]),
        {stiffness: 300, damping: 25, mass: 0.5}
    );

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        mx.set(x);
        my.set(y);
    };

    const handleMouseLeave = () => {
        mx.set(0);
        my.set(0);
    };

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);

        const ripple: Ripple = {
            id: Date.now(),
            x: e.clientX - rect.left - size / 2,
            y: e.clientY - rect.top - size / 2,
            size
        };

        setRipples(prev => [...prev, ripple]);

        window.setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== ripple.id));
        }, 600);

        onClick && onClick()
    };

    return (
        <motion.button
            ref={ref}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformPerspective: 700
            }}
            className={[
                "relative overflow-hidden px-8 py-4 cursor-pointer bg-black rounded-md",
                "will-change-transform",
                className
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}

            <AnimatePresence>
                {ripples.map(ripple => (
                    <motion.span
                        key={ripple.id}
                        initial={{scale: 0, opacity: 0.6}}
                        animate={{scale: 2.5, opacity: 0}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.6, ease: "easeOut"}}
                        style={{
                            position: "absolute",
                            top: ripple.y,
                            left: ripple.x,
                            width: ripple.size,
                            height: ripple.size,
                            borderRadius: "50%",
                            background: rippleColor,
                            pointerEvents: "none"
                        }}
                    />
                ))}
            </AnimatePresence>
        </motion.button>
    );
}