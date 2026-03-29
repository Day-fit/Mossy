import zxcvbn from 'zxcvbn';
import { motion } from 'framer-motion';

type Props = { password: string };

export default function StrengthMeter({ password }: Props) {
	const result = zxcvbn(password);
	const score = Math.max(0, Math.min(4, result.score));
	const percent = Math.max(5, Math.round((score / 4) * 100));

	const hue = Math.round((score / 4) * 120);
	const gradient = `linear-gradient(90deg, hsl(${hue} 85% 50%), hsl(${Math.max(
		hue - 20,
		0
	)} 85% 40%))`;

	const labels = ['Very bad', 'Bad', 'Mid', 'Good', 'Perfect!'];
	const label = labels[score];

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-2 text-sm text-gray-600">
				<span className="truncate">{label}</span>
			</div>

			<div className="w-full h-2 rounded overflow-hidden bg-gray-200">
				<motion.div
					className="h-full"
					style={{ background: gradient, width: `${percent}%` }}
					initial={{ width: 0 }}
					animate={{ width: `${percent}%` }}
					transition={{ ease: 'easeOut', duration: 0.35 }}
				/>
			</div>
		</div>
	);
}
