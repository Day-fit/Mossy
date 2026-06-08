import { FaTags } from 'react-icons/fa';
import { IoIosArrowDown } from 'react-icons/io';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
	executeGetTagsRequest,
	type GetTagsResponseDto,
} from '../../api/tags.api.ts';
import { useVaultStore } from '../../store/vaultStore.ts';

export default function TagsMenu() {
	const [isOpen, setIsOpen] = useState(false);
	const [tags, setTags] = useState<GetTagsResponseDto[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const { selectedVaultId } = useVaultStore();

	useEffect(() => {
		if (!selectedVaultId) {
			setTags([]);
			setError(null);
			setLoading(true);
			return;
		}

		setError(null);

		executeGetTagsRequest(selectedVaultId)
			.then((response) => {
				setTags(response);
			})
			.catch(() => {
				setError('Failed to load tags');
			})
			.finally(() => {
				setLoading(false);
			});
	}, [selectedVaultId]);

	return (
		<div className={'flex flex-col items-start gap-1 relative'}>
			<div
				className={
					'w-fit flex gap-1 items-center p-2 border-emerald-800 border-2 rounded-md cursor-pointer'
				}
				onClick={() => setIsOpen(!isOpen)}
			>
				<FaTags className={'text-emerald-800'} />
				<h3 className={'select-none'}>Tags</h3>

				<motion.div animate={{ rotate: isOpen ? -180 : 0 }}>
					<IoIosArrowDown className={'text-gray-500'} />
				</motion.div>
			</div>

			<motion.div
				initial={false}
				animate={{
					height: isOpen ? 'auto' : 0,
				}}
				className="origin-top absolute top-full left-0 w-full bg-white shadow-md rounded-md flex flex-col gap-1 overflow-hidden"
			>
				{error ? (
					<h3>{error}</h3>
				) : loading ? (
					<h3>Loading...</h3>
				) : (
					tags.map((tag) => (
						<div
							className={'rounded-md'}
							style={{ color: tag.color }}
							key={tag.tagId}
						>
							<h3>{tag.tagName}</h3>
						</div>
					))
				)}
			</motion.div>
		</div>
	);
}
