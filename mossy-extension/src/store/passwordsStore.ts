import { create } from "zustand";
import type { PasswordMetadataDto } from "../types";

type PasswordsStoreState = {
  passwords: PasswordMetadataDto[];
  setPasswords: (value: PasswordMetadataDto[]) => void;
  getPasswords: () => PasswordMetadataDto[];
};

const STORAGE_KEY = "passwords";

export const usePasswordsStore = create<PasswordsStoreState>((set, get) => {
  const save = (value: PasswordMetadataDto[]) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: value });
    }
  };

  const load = () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;

    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const data = res?.[STORAGE_KEY];
      Array.isArray(data) && set({ passwords: data });
    });
  };

  load();

  return {
    passwords: [],
    setPasswords: (value) => {
      set({ passwords: value });
      save(value);
    },
    getPasswords: () => get().passwords,
  };
});
