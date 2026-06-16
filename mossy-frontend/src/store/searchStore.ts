import { create } from 'zustand';

type SearchStore = {
	query: string;
	selectedTagsId: string[];
	setQuery: (value: string) => void;
	addSelectedTag: (tagId: string) => void;
	removeSelectedTag: (value: string) => void;
};

export const useSearchStore = create<SearchStore>((set) => ({
	query: '',
	selectedTagsId: [],
	setQuery: (value) => set({ query: value }),
	addSelectedTag: (tagId) =>
		set((state) => ({
			selectedTagsId: [...state.selectedTagsId, tagId],
		})),
	removeSelectedTag: (tagId) =>
		set((state) => ({
			selectedTagsId: state.selectedTagsId.filter((id) => id !== tagId),
		})),
}));
