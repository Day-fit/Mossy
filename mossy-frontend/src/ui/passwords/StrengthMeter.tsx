import zxcvbn from 'zxcvbn';
import { motion } from 'framer-motion';

type Props = { password: string };

export default function StrengthMeter({ password }: Props) {
    const isEmpty = password.trim().length === 0;

    const result = isEmpty ? null : zxcvbn(password);
    const score = isEmpty ? 0 : Math.max(0, Math.min(4, result!.score));

    const percent = isEmpty ? 0 : Math.max(5, Math.round((score / 4) * 100));

    const gradients = [
        'var(--color-danger)',
        'linear-gradient(90deg, var(--color-danger), var(--color-warning))',
        'var(--color-warning)',
        'linear-gradient(90deg, var(--color-warning), var(--color-brand))',
        'var(--color-brand)',
    ];

    const labels = ['Very bad', 'Bad', 'Mid', 'Good', 'Perfect!'];

    return (
        <div className="w-full">
            <div className="text-sm flex items-center mb-2 text-fg-muted">
                <span className="truncate">{isEmpty ? '' : labels[score]}</span>
            </div>

            <div className="h-2 rounded-full overflow-hidden bg-border">
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
