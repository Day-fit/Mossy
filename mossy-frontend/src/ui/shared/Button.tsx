import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import { useState, useRef, type MouseEvent, type ReactNode } from 'react';

interface Ripple {
	id: number;
	x: number;
	y: number;
	size: number;
}

type Variant = 'primary' | 'outline' | 'ghost' | 'destructive' | 'icon';
type PaddingVariant = 'none' | 'small' | 'medium' | 'large';
type Tone = 'neutral' | 'destructive';

type RippleButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
	children: ReactNode;
	className?: string;
	rippleColor?: string;
	variant?: Variant;
	padding?: PaddingVariant;
	tone?: Tone;
};

export default function Button({
	className,
	children,
	onClick,
	type,
	variant = 'primary',
	rippleColor = variant === 'primary'
		? 'rgba(255, 255, 255, 0.6)'
		: 'rgba(0, 0, 0, 0.6)',
	padding = 'large',
	tone = 'neutral',
	...buttonProps
}: RippleButtonProps) {
	const [ripples, setRipples] = useState<Ripple[]>([]);
	const ref = useRef<HTMLButtonElement>(null);

	const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
		if (variant !== 'icon') {
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
		}

		onClick?.(e);
	};

	const variantClassNames: Record<Variant, string> = {
		primary: 'bg-[#007735] hover:bg-[#005f29] text-white',
		destructive: 'bg-red-700 hover:bg-red-800 text-white',
		outline:
			'bg-transparent box-border border-2 border-[#007735] text-[#007735]',
		ghost: 'bg-transparent box-border',
		icon: 'inline-flex h-8 w-8 shrink-0 items-center justify-center border bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
	};

	const toneClassNames: Record<Tone, string> = {
		neutral:
			'border-gray-400 text-gray-700 hover:bg-gray-50 focus-visible:ring-[#007735]',
		destructive:
			'border-red-300 text-red-600 hover:bg-red-50 focus-visible:ring-red-600',
	};

	const paddingClassNames: Record<PaddingVariant, string> = {
		small: 'px-2 py-1',
		medium: 'px-4 py-2',
		large: 'px-8 py-4',
		none: '',
	};

	return (
		<motion.button
			{...buttonProps}
			ref={ref}
			type={type}
			onClick={handleClick}
			className={[
				`relative overflow-hidden ${paddingClassNames[variant === 'icon' ? 'none' : padding]} cursor-pointer ${variant === 'icon' ? 'rounded-sm' : 'rounded-md'} ${variantClassNames[variant]} ${variant === 'icon' ? toneClassNames[tone] : ''}`,
				className,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{children}

			{variant !== 'icon' && (
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
			)}
		</motion.button>
	);
}
