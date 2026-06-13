import { create } from 'zustand';
import {
	executeGetTagsRequest,
	type GetTagsResponseDto,
} from '../api/tags.api.ts';

interface TagState {
	tags: GetTagsResponseDto[];
	loading: boolean;
	error: string | null;
	vaultId: string | null;

	fetchTags: (vaultId: string) => Promise<void>;
	addTag: (tag: GetTagsResponseDto) => void;
	updateTag: (updatedTag: GetTagsResponseDto) => void;
	deleteTag: (tagId: string) => void;
	reset: () => void;
}

export const useTagStore = create<TagState>((set) => ({
	tags: [],
	loading: false,
	error: null,
	vaultId: null,

	fetchTags: async (vaultId: string) => {
		set({ loading: true, error: null, vaultId });
		try {
			const tags = await executeGetTagsRequest(vaultId);
			set({ tags, loading: false });
		} catch {
			set({ error: 'Failed to load tags', loading: false });
		}
	},

	addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),

	updateTag: (updatedTag) =>
		set((state) => ({
			tags: state.tags.map((t) =>
				t.tagId === updatedTag.tagId ? updatedTag : t
			),
		})),

	deleteTag: (tagId: string) => {
		set((state) => ({
			tags: state.tags.filter((t) => t.tagId !== tagId),
		}));
	},

	reset: () => set({ tags: [], loading: false, error: null, vaultId: null }),
}));
