import zxcvbn from 'zxcvbn';
import { motion } from 'framer-motion';

type Props = { password: string };

export default function StrengthMeter({ password }: Props) {
	const isEmpty = password.trim().length === 0;

	const result = isEmpty ? null : zxcvbn(password);
	const score = isEmpty ? 0 : Math.max(0, Math.min(4, result!.score));

	const percent = isEmpty ? 0 : Math.max(5, Math.round((score / 4) * 100));

	const gradients = [
		'linear-gradient(90deg, #ef4444, #f97316)', // weak
		'linear-gradient(90deg, #f97316, #facc15)', // low-mid
		'linear-gradient(90deg, #facc15, #84cc16)', // mid
		'linear-gradient(90deg, #22c55e, #10b981)', // strong
		'linear-gradient(90deg, #10b981, #06b6d4)', // very strong
	];

	const labels = ['Very bad', 'Bad', 'Mid', 'Good', 'Perfect!'];

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-2 text-sm text-gray-600">
				<span className="truncate">{isEmpty ? '' : labels[score]}</span>
			</div>

			<div className="w-full h-2 rounded-full overflow-hidden bg-gray-200">
				<motion.div
					className="h-full rounded-full"
					style={{
						background: isEmpty ? 'transparent' : gradients[score],
						width: `${percent}%`,
					}}
					initial={{ width: 0 }}
					animate={{ width: `${percent}%` }}
					transition={{ ease: 'easeOut', duration: 0.35 }}
				/>
			</div>
		</div>
	);
}
