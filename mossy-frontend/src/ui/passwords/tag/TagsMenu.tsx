import { FaTags } from 'react-icons/fa';
import { IoIosArrowDown } from 'react-icons/io';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useVaultStore } from '../../../store/vaultStore.ts';
import { useTagStore } from '../../../store/tagStore.ts';
import AddTagButton from './AddTagButton.tsx';
import TagListItem from './TagListItem.tsx';

export default function TagsMenu() {
	const [isOpen, setIsOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	const { selectedVaultId } = useVaultStore();
	const { tags, loading, error, fetchTags, updateTag } = useTagStore();

	useEffect(() => {
		if (!selectedVaultId) return;
		void fetchTags(selectedVaultId);
	}, [selectedVaultId]);

	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		window.addEventListener('pointerdown', handler);
		return () => window.removeEventListener('pointerdown', handler);
	}, [isOpen]);

	return (
		<div
			ref={rootRef}
			className="z-20 flex flex-col items-start gap-1 relative"
		>
			<div
				className="w-fit flex gap-1 items-center p-2 border-emerald-800 border-2 rounded-md cursor-pointer"
				onClick={() => setIsOpen((v) => !v)}
			>
				<FaTags className="text-emerald-800" />
				<h3 className="select-none">Tags</h3>
				<motion.div animate={{ rotate: isOpen ? -180 : 0 }}>
					<IoIosArrowDown className="text-gray-500" />
				</motion.div>
			</div>

			<motion.div
				layout
				initial={false}
				animate={{
					opacity: isOpen ? 1 : 0,
					pointerEvents: isOpen ? 'auto' : 'none',
				}}
				className="origin-top absolute top-full right-0 min-w-max bg-white shadow-md rounded-md overflow-y-hidden"
			>
				<div className="p-4 flex flex-col gap-3 max-h-60 overflow-y-auto">
					{error ? (
						<h3>{error}</h3>
					) : loading ? (
						<h3>Loading...</h3>
					) : (
						<>
							{tags.map((tag) => (
								<TagListItem
									tagId={tag.tagId}
									color={tag.color}
									name={tag.tagName}
									onUpdate={updateTag}
								/>
							))}
							<AddTagButton />
						</>
					)}
				</div>
			</motion.div>
		</div>
	);
}
