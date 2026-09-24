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
                className="text-sm font-semibold inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-fg-subtle hover:border-border-strong hover:bg-surface-subtle hover:text-fg-muted"
            >
                <MdAdd size={14} />
                add tag
            </button>
        );
    }

    return <TagInput onFocusOut={() => setIsAddingTag(false)} />;
}
