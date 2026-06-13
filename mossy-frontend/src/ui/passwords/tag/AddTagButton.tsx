import { useState } from 'react';
import { MdAdd } from 'react-icons/md';
import TagInput from './TagInput.tsx';

export default function AddTagButton() {
	const [isAddingTag, setIsAddingTag] = useState(false);

	const handleOpen = () => {
		setIsAddingTag(true);
	};

	if (!isAddingTag) {
		return (
			<button
				onClick={handleOpen}
				className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-all"
			>
				<MdAdd size={14} />
				add tag
			</button>
		);
	}

	return <TagInput onFocusOut={() => setIsAddingTag(false)} />;
}
