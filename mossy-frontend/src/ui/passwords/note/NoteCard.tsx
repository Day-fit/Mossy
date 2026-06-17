import { motion } from 'framer-motion';
import { MdCheck } from 'react-icons/md';
import { useEffect, useState } from 'react';
import {
	executeGetNoteRequest,
	executeSaveNoteRequest,
} from '../../../api/note.api.ts';
import { RiErrorWarningLine } from 'react-icons/ri';
import { useVaultStore } from '../../../store/vaultStore.ts';
import { useEncryptionHook } from '../../../hooks/useEncryptionHook.ts';
import { KeyNotFoundException } from '../../../exception/KeyNotFoundException.ts';
import PasswordPinModal from '../../shared/PasswordPinModal.tsx';
import KeySyncModal from '../KeySyncModal.tsx';
import * as React from 'react';

type NoteCardProps = {
	passwordId: string;
	isOpen: boolean;
	setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function NoteCard({
	isOpen,
	setIsOpen,
	passwordId,
}: NoteCardProps) {
	const [note, setNote] = useState('');
	const [isLoaded, setIsLoaded] = useState(false);
	const [isError, setIsError] = useState(false);
	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const [isKeySyncModalActive, setIsKeySyncModalActive] = useState(false);
	const [lastAction, setLastAction] = useState<
		((pin: string) => void) | undefined
	>();

	const { selectedVaultId } = useVaultStore();
	const { encrypt, decrypt, isPinPresent } = useEncryptionHook();

	const runWithVaultKeySync = async (action: () => Promise<void>) => {
		if (!selectedVaultId) return;

		try {
			if (!(await isPinPresent(selectedVaultId))) {
				setLastAction(() => (_: string) => {
					void action();
				});
				setIsPinModalActive(true);
				return;
			}
		} catch (error) {
			if (error instanceof KeyNotFoundException) {
				setLastAction(() => (_: string) => {
					void action();
				});
				setIsKeySyncModalActive(true);
				return;
			}
			throw error;
		}

		await action();
	};

	const loadNote = async () => {
		if (!selectedVaultId) return;

		setIsLoaded(false);
		setIsError(false);

		try {
			const response = await executeGetNoteRequest(
				selectedVaultId,
				passwordId
			);
			if (!response.content) {
				setNote('');
				return;
			}
			setNote(await decrypt(response.content, selectedVaultId));
		} catch {
			setIsError(true);
		} finally {
			setIsLoaded(true);
		}
	};

	useEffect(() => {
		if (!isOpen || !selectedVaultId) return;
		void runWithVaultKeySync(loadNote);
	}, [isOpen, passwordId, selectedVaultId]);

	const handleSaveNote = async () => {
		if (!selectedVaultId) return;

		setIsLoaded(false);
		setIsError(false);

		try {
			await runWithVaultKeySync(async () => {
				const encryptedNote = await encrypt(note, selectedVaultId);
				await executeSaveNoteRequest(
					selectedVaultId,
					passwordId,
					encryptedNote
				);
			});

			setIsOpen(false);
		} catch {
			setIsError(true);
		} finally {
			setIsLoaded(true);
		}
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
			{isPinModalActive && (
				<PasswordPinModal
					vaultId={selectedVaultId}
					setIsPinModalActive={setIsPinModalActive}
					afterPinEntered={lastAction}
				/>
			)}

			{isKeySyncModalActive && selectedVaultId && (
				<KeySyncModal
					setIsKeySyncModalActive={setIsKeySyncModalActive}
					vaultId={selectedVaultId}
				/>
			)}

			<div className={`rounded-xl border border-zinc-200 p-3 bg-zinc-50`}>
				{!isError ? (
					<>
						<textarea
							value={note}
							onChange={(e) => {
								if (!isLoaded) return;
								setNote(e.target.value);
							}}
							placeholder={
								isLoaded ? `Add note...` : 'Loading...'
							}
							className={`min-h-28 w-full resize-none ${
								!isLoaded ? 'animate-pulse border-gray-500' : ''
							} bg-transparent text-sm outline-none placeholder:text-zinc-400`}
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
							An error occurred. Please try again later
						</h2>
					</div>
				)}
			</div>
		</motion.div>
	);
}
