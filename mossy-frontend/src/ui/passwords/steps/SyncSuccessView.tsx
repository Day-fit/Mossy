import { motion } from 'framer-motion';

export default function SyncSuccessView() {
	return (
		<motion.div
			className="flex flex-col items-center justify-center gap-3 w-full h-full"
			initial={{ opacity: 0, scale: 0.7 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
		>
			<svg width="88" height="88" viewBox="0 0 80 80">
				<circle
					cx="40"
					cy="40"
					r="35"
					fill="none"
					stroke="#e6f4ee"
					strokeWidth="6"
				/>
				<motion.circle
					cx="40"
					cy="40"
					r="35"
					fill="none"
					stroke="#007735"
					strokeWidth="6"
					strokeLinecap="round"
					transform="rotate(-90 40 40)"
					initial={{ pathLength: 0 }}
					animate={{ pathLength: 1 }}
					transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
				/>
				<motion.polyline
					points="24,41 35,52 56,30"
					fill="none"
					stroke="#007735"
					strokeWidth="5.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					initial={{ pathLength: 0 }}
					animate={{ pathLength: 1 }}
					transition={{
						duration: 0.35,
						delay: 0.55,
						ease: 'easeOut',
					}}
				/>
			</svg>
			<motion.p
				className="text-xl font-medium text-gray-900"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.7 }}
			>
				Key synchronized!
			</motion.p>
			<motion.p
				className="text-sm text-gray-500 text-center"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.85 }}
			>
				Your key has been securely synchronized.
				<br />
				This window will close automatically.
			</motion.p>
			<motion.div
				className="w-36 h-0.75 rounded-full bg-gray-100 overflow-hidden"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.9 }}
			>
				<motion.div
					className="h-full bg-[#007735] rounded-full"
					initial={{ width: '100%' }}
					animate={{ width: '0%' }}
					transition={{ duration: 2.5, delay: 1, ease: 'linear' }}
				/>
			</motion.div>
		</motion.div>
	);
}
