type TagProps = {
    tagId?: string;
    name: string;
    color: string;
};

export default function Tag({ name, color }: TagProps) {
    return (
        <div
            className="rounded-md flex items-center gap-2 px-2 py-1"
            style={{
                background: `color-mix(in srgb, ${color} 15%, var(--color-surface))`,
            }}
        >
            <span
                className="w-2 h-2 rounded-full border border-fg-primary/10"
                style={{ background: color }}
            />

            <span className="text-xs">{name}</span>
        </div>
    );
}
