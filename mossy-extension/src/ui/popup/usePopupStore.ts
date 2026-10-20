import { create } from 'zustand';
import type { PopupView } from './types';

// Metadata only. Secrets live in transient input elements and action workers.
export const usePopupStore = create<{
    view?: PopupView;
    error?: string;
    loading: boolean;
    set: (
        value: Partial<{
            view: PopupView;
            error: string | undefined;
            loading: boolean;
        }>
    ) => void;
}>((set) => ({ loading: true, set }));
