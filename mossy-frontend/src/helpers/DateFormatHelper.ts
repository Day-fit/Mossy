export const formatDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString();
};

export const formatDateTime = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString();
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'always',
});

const relativeTimeUnits = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['week', 7 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
] as const;

export const formatRelativeTime = (value: string, now = new Date()) => {
    const date = new Date(value);
    const differenceInSeconds = (date.getTime() - now.getTime()) / 1000;

    if (!Number.isFinite(differenceInSeconds)) {
        return value;
    }

    for (const [unit, secondsInUnit] of relativeTimeUnits) {
        if (Math.abs(differenceInSeconds) >= secondsInUnit) {
            return relativeTimeFormatter.format(
                Math.round(differenceInSeconds / secondsInUnit),
                unit
            );
        }
    }

    return 'just now';
};
