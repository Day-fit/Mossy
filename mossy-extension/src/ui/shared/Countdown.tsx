import { useEffect, useState } from 'react';
import { MdTimer } from 'react-icons/md';

export default function Countdown({
    deadline,
    label = 'Expires in',
    className = 'mt-3',
}: {
    deadline: number;
    label?: string;
    className?: string;
}) {
    const remaining = () =>
        Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const [seconds, setSeconds] = useState(remaining);

    useEffect(() => {
        const update = () => {
            const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setSeconds(next);
            if (!next) clearInterval(timer);
        };
        const timer = setInterval(update, 250);
        update();
        return () => clearInterval(timer);
    }, [deadline]);

    return (
        <p
            className={`flex items-center gap-1.5 text-xs leading-[1.6] tabular-nums ${seconds <= 3 ? 'text-fg-danger' : 'text-fg-warning'} ${className}`}
            role="timer"
        >
            <MdTimer size={15} aria-hidden="true" />
            <span>
                {label} <strong className="font-semibold">{seconds}</strong>{' '}
                seconds
            </span>
        </p>
    );
}
