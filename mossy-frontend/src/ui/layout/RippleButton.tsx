import { motion, AnimatePresence } from 'framer-motion';
import {
	useState,
	useRef,
	type MouseEvent,
	type ReactNode,
	type ButtonHTMLAttributes,
} from 'react';

interface Ripple {
	id: number;
	x: number;
	y: number;
	size: number;
}

type Variant = 'primary' | 'outline';

type RippleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	children: ReactNode;
	className?: string;
	rippleColor?: string;
	variant?: Variant;
};

export default function RippleButton({
	className,
	children,
	onClick,
	type,
	variant = 'primary',
	rippleColor = variant === 'primary'
		? 'rgba(255, 255, 255, 0.6)'
		: 'rgba(0, 0, 0, 0.6)',
}: RippleButtonProps) {
	const [ripples, setRipples] = useState<Ripple[]>([]);
	const ref = useRef<HTMLButtonElement>(null);

	const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const size = Math.max(rect.width, rect.height);

		const ripple: Ripple = {
			id: Date.now(),
			x: e.clientX - rect.left - size / 2,
			y: e.clientY - rect.top - size / 2,
			size,
		};

		setRipples((prev) => [...prev, ripple]);

		window.setTimeout(() => {
			setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
		}, 600);

		onClick && onClick(e);
	};

	const variantClassNames = (variant: Variant) => {
		switch (variant) {
			case 'primary':
				return 'bg-black';

			case 'outline':
				return 'bg-transparent box-border border-2 border-gray-800';
		}
	};

	return (
		<motion.button
			ref={ref}
			type={type}
			onClick={handleClick}
			className={[
				`relative overflow-hidden px-8 py-4 cursor-pointer rounded-md ${variantClassNames(variant)}`,
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{children}

			<AnimatePresence>
				{ripples.map((ripple) => (
					<motion.span
						key={ripple.id}
						initial={{ scale: 0, opacity: 0.6 }}
						animate={{ scale: 2.5, opacity: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.6, ease: 'easeOut' }}
						style={{
							position: 'absolute',
							top: ripple.y,
							left: ripple.x,
							width: ripple.size,
							height: ripple.size,
							borderRadius: '50%',
							background: rippleColor,
							pointerEvents: 'none',
						}}
					/>
				))}
			</AnimatePresence>
		</motion.button>
	);
}
