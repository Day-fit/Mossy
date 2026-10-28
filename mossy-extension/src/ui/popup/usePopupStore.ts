import { create } from 'zustand';
import type { PopupView } from './types';

type PopupState = {
    view?: PopupView;
    error?: string;
    loading: boolean;
};

type PopupStore = PopupState & {
    set: (value: Partial<PopupState>) => void;
};

// Metadata only. Secrets live in transient input elements and action workers.
export const usePopupStore = create<PopupStore>((set) => ({
    loading: true,
    set,
}));
