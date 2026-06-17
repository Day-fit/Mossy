import { motion } from 'framer-motion';
import { MdCheck } from 'react-icons/md';
import { useEffect, useState } from 'react';
import { executeGetNoteRequest } from '../../../api/note.api.ts';
import { RiErrorWarningLine } from 'react-icons/ri';
import { useVaultStore } from '../../../store/vaultStore.ts';

type NoteCardProps = {
	passwordId: string;
	isOpen: boolean;
};

export default function NoteCard({ isOpen, passwordId }: NoteCardProps) {
	const [note, setNote] = useState('');
	const [isLoaded, setIsLoaded] = useState(false);
	const [isError, setIsError] = useState(false);

	const { selectedVaultId } = useVaultStore();

	useEffect(() => {
		executeGetNoteRequest(selectedVaultId, passwordId)
			.then((res) => {
				setNote(res.content);
			})
			.catch(() => setIsError(true))
			.finally(() => setIsLoaded(true));
	}, []);

	const handleSaveNote = () => {
		executeGetNoteRequest(selectedVaultId, passwordId).then((res) => {
			setNote(res.content);
		});
	};

	return (
		<motion.div
			layout
			initial={false}
			animate={{
				height: isOpen ? 'auto' : 0,
				opacity: isOpen ? 1 : 0,
			}}
			transition={{
				layout: { duration: 0.2 },
				opacity: { duration: 0.15 },
			}}
			className="overflow-hidden"
		>
			<div className={`rounded-xl border border-zinc-200 p-3 bg-zinc-50`}>
				{!isError ? (
					<>
						{' '}
						<textarea
							placeholder="Add note..."
							className={`min-h-28 w-full resize-none ${isLoaded ? 'animate-pulse border-gray-500' : ''} bg-transparent text-sm outline-none placeholder:text-zinc-400`}
							value={note}
						/>
						<div className="mt-2 flex justify-end">
							<motion.button
								whileTap={{ scale: 0.95 }}
								className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 text-white"
								onClick={handleSaveNote}
							>
								<MdCheck size={18} />
							</motion.button>
						</div>
					</>
				) : (
					<div className={'flex flex-col items-center gap-2'}>
						<RiErrorWarningLine size={64} />
						<h2 className={'text-center text-xl text-gray-600'}>
							An error occurred during loading note. Please try
							again later
						</h2>
					</div>
				)}
			</div>
		</motion.div>
	);
}
