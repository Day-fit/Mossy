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
				background: `color-mix(in srgb, ${color} 15%, white)`,
			}}
		>
			<span
				className="block w-2 h-2 rounded-full border border-black/10"
				style={{ background: color }}
			/>

			<h3 className="text-xs">{name}</h3>
		</div>
	);
}
