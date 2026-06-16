type NoteModalProps = {
	setIsModalOpen: (isOpen: boolean) => void;
	isOpen: boolean;
};

export default function NoteModal({ setIsModalOpen, isOpen }: NoteModalProps) {
	return (
		<div
			className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 ${isOpen ? '' : 'hidden'}`}
			onClick={() => setIsModalOpen(false)}
		>
			<section className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
				<input type="text" />
			</section>
		</div>
	);
}
