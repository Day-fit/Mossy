import { useEffect, useState } from 'react';
import { MdTimer } from 'react-icons/md';

export default function Countdown({
    deadline,
    label = 'Expires in',
}: {
    deadline: number;
    label?: string;
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
            className={`countdown${seconds <= 3 ? ' countdown-urgent' : ''}`}
            role="timer"
        >
            <MdTimer size={15} aria-hidden="true" />
            <span>
                {label} <strong>{seconds}</strong> seconds
            </span>
        </p>
    );
}
