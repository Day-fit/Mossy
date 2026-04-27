import { create } from "zustand";
import type { CapturedCredential } from "../types";

type CapturedStoreState = {
  captured: CapturedCredential[];
  setCaptured: (value: CapturedCredential[]) => void;
};

export const useCapturedStore = create<CapturedStoreState>((set) => ({
  captured: [],
  setCaptured: (value) => set({ captured: value }),
}));
