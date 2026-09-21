import { MdDelete, MdEdit } from 'react-icons/md';
import { useState } from 'react';
import TagInput from './TagInput.tsx';
import { executeDeleteTagRequest } from '../../../api/tags.api.ts';
import { useVaultStore } from '../../../store/vaultStore.ts';
import { useTagStore } from '../../../store/tagStore.ts';
import { useSearchStore } from '../../../store/searchStore.ts';

type TagListItemProps = {
    tagId: string;
    name: string;
    color: string;
    onUpdate: (tag: { tagId: string; tagName: string; color: string }) => void;
};

export default function TagListItem({
    tagId,
    color,
    name,
    onUpdate,
}: TagListItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSelected, setIsSelected] = useState(false);

    const { selectedVaultId } = useVaultStore();
    const { deleteTag } = useTagStore();
    const { addSelectedTag, removeSelectedTag } = useSearchStore();

    if (isEditing) {
        return (
            <TagInput
                tagId={tagId}
                name={name}
                color={color}
                onFocusOut={() => setIsEditing(false)}
                onUpdate={onUpdate}
            />
        );
    }

    const handleDeletion = () => {
        executeDeleteTagRequest({
            vaultId: selectedVaultId,
            tagId: tagId,
        }).then(() => {
            deleteTag(tagId);
        });
    };

    return (
        <div
            className={`flex ${isSelected ? 'bg-brand-muted' : 'bg-surface-muted'} rounded-md p-2`}
            onClick={() => {
                const _isSelected = !isSelected;

                if (_isSelected) {
                    addSelectedTag(tagId);
                } else {
                    removeSelectedTag(tagId);
                }

                setIsSelected(_isSelected);
            }}
        >
            <span
                className="block w-4 h-4 rounded-full border border-swatch-border pointer-events-none"
                style={{ background: color }}
            />

            <h3
                className={
                    'type-caption w-28 px-1.5 placeholder:text-fg-subtle cursor-text'
                }
            >
                {name}
            </h3>

            <MdEdit
                className={'cursor-pointer'}
                size={'1rem'}
                onClick={() => setIsEditing(true)}
            />

            <MdDelete
                size={'1rem'}
                className={'cursor-pointer text-danger'}
                onClick={() => {
                    handleDeletion();
                }}
            />
        </div>
    );
}
