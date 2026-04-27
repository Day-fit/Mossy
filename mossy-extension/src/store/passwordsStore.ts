import { create } from "zustand";
import type { PasswordMetadataDto } from "../types";

type PasswordsStoreState = {
  passwords: PasswordMetadataDto[];
  setPasswords: (value: PasswordMetadataDto[]) => void;
};

export const usePasswordsStore = create<PasswordsStoreState>((set) => ({
  passwords: [],
  setPasswords: (value) => set({ passwords: value }),
}));
