import { MdAdd } from 'react-icons/md';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTagStore } from '../../../store/tagStore.ts';
import {
    executeAssignTagRequest,
    executeUnassignTagRequest,
    type GetTagsResponseDto,
} from '../../../api/tags.api.ts';
import type { TagDto } from '../../../api/password.api.ts';
import { useVaultStore } from '../../../store/vaultStore.ts';
import * as React from 'react';
import Button from '../../shared/Button.tsx';

interface AssignTagDropdownProps {
    assignedTags: TagDto[];
    setAssignedTags: React.Dispatch<React.SetStateAction<TagDto[]>>;
    passwordId: string;
}

export default function AssignTagDropdown({
    assignedTags,
    setAssignedTags,
    passwordId,
}: AssignTagDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const { selectedVaultId } = useVaultStore();
    const { tags, loading, error } = useTagStore();

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

    const handleToggleTag = async (tag: GetTagsResponseDto) => {
        const isAssigned = assignedTags.some((t) => t.tagId === tag.tagId);

        if (isAssigned) {
            await executeUnassignTagRequest({
                vaultId: selectedVaultId,
                tagId: tag.tagId,
                passwordId,
            });

            setAssignedTags((prev) =>
                prev.filter((t) => t.tagId !== tag.tagId)
            );

            return;
        }

        await executeAssignTagRequest({
            vaultId: selectedVaultId,
            tagId: tag.tagId,
            passwordId,
        });

        setAssignedTags((prev) => [...prev, tag]);
    };

    return (
        <div ref={rootRef} className="z-20 flex flex-col items-start relative">
            <Button
                variant="icon"
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="border-2 border-brand"
                aria-label="Assign tag"
            >
                <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <MdAdd />
                </motion.div>
            </Button>

            <motion.div
                initial={false}
                animate={{
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                }}
                className="absolute top-full left-0 min-w-max bg-surface shadow-card rounded-md overflow-hidden"
            >
                <div className="p-3 flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {error ? (
                        <p className="text-sm text-danger">{error}</p>
                    ) : loading ? (
                        <p className="text-sm text-fg-subtle">Loading...</p>
                    ) : tags.length === 0 ? (
                        <p className="text-sm text-fg-subtle">
                            No tags available
                        </p>
                    ) : (
                        tags.map((tag) => {
                            const isAssigned = assignedTags.some(
                                (t) => t.tagId === tag.tagId
                            );
                            return (
                                <button
                                    key={tag.tagId}
                                    type="button"
                                    onClick={() => handleToggleTag(tag)}
                                    className={`text-sm font-semibold flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${
                                        isAssigned
                                            ? 'bg-brand/5 text-brand'
                                            : 'hover:bg-surface-muted text-fg-secondary'
                                    }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <span className="select-none">
                                        {tag.tagName}
                                    </span>
                                    {isAssigned && (
                                        <span className="ml-auto text-xs">
                                            ✓
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </div>
    );
}
