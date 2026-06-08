import { FaTags } from 'react-icons/fa';
import { IoIosArrowDown } from 'react-icons/io';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function TagsButton() {
	const [isOpen, setIsOpen] = useState(false);
	const

	useEffect(() => {}, []);

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
				style={{ originY: 0 }}
				className="absolute top-full left-0 w-full bg-white shadow-md rounded-md flex flex-col gap-1 overflow-hidden"
			>
				<h4>Chuj</h4>
			</motion.div>
		</div>
	);
}
