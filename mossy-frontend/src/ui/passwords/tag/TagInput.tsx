import { MdCheck } from 'react-icons/md';
import {
	executeCreateTagRequest,
	executeUpdateTagRequest,
} from '../../../api/tags.api.ts';
import { useVaultStore } from '../../../store/vaultStore.ts';
import { useEffect, useRef, useState } from 'react';
import * as React from 'react';
import { useTagStore } from '../../../store/tagStore.ts';

type TagInputProps = {
	tagId?: string;
	name?: string;
	color?: string;
	onFocusOut: () => void;
	onUpdate?: (tag: { tagId: string; tagName: string; color: string }) => void;
};

export default function TagInput({
	name = '',
	color = '#007735',
	onFocusOut,
	tagId,
	onUpdate,
}: TagInputProps) {
	const { selectedVaultId } = useVaultStore();
	const { fetchTags } = useTagStore();

	const ref = useRef<HTMLDivElement | null>(null);

	const [tagName, setTagName] = useState(name);
	const [tagColor, setTagColor] = useState(color);

	useEffect(() => {
		const handlePointerDown = (e: PointerEvent) => {
			const el = ref.current;
			const target = e.target as Node | null;

			if (!el || !target) return;

			if (!el.contains(target)) {
				onFocusOut();
			}
		};

		document.addEventListener('pointerdown', handlePointerDown, true);
		return () =>
			document.removeEventListener(
				'pointerdown',
				handlePointerDown,
				true
			);
	}, [onFocusOut]);

	const handleConfirm = async () => {
		const trimmed = tagName.trim();

		if (!trimmed) return;

		if (!tagId) {
			await executeCreateTagRequest({
				vaultId: selectedVaultId,
				tagName: trimmed,
				color: tagColor,
			});

			await fetchTags(selectedVaultId);
		} else {
			await executeUpdateTagRequest({
				tagId,
				vaultId: selectedVaultId,
				tagName: trimmed,
				color: tagColor,
			});

			onUpdate?.({
				tagId,
				tagName: trimmed,
				color: tagColor,
			});
		}

		onFocusOut();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') void handleConfirm();
		if (e.key === 'Escape') onFocusOut();
	};

	return (
		<div
			ref={ref}
			className="inline-flex items-center gap-0 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
		>
			<label className="relative w-4 h-4 cursor-pointer shrink-0">
				<span
					className="block w-4 h-4 rounded-full border border-black/10 pointer-events-none"
					style={{ background: tagColor }}
				/>
				<input
					type="color"
					value={tagColor}
					onChange={(e) => setTagColor(e.target.value)}
					className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
				/>
			</label>

			<input
				type="text"
				value={tagName}
				onChange={(e) => setTagName(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="tag name…"
				className="border-none outline-none bg-transparent text-xs w-28 px-1.5 placeholder:text-gray-400"
			/>

			<button
				onClick={handleConfirm}
				className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 text-white hover:opacity-80 active:scale-95 transition-all shrink-0"
				aria-label="add tag"
			>
				<MdCheck size={12} />
			</button>
		</div>
	);
}
