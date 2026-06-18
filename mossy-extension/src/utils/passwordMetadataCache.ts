import type { PasswordMetadataDto } from "../types";

const STORAGE_KEY = "passwords";
let cachedPasswords: PasswordMetadataDto[] = [];
let isInitialized = false;
const listeners = new Set<(value: PasswordMetadataDto[]) => void>();

export function getCachedPasswords() {
  return cachedPasswords;
}

export function setCachedPasswords(value: PasswordMetadataDto[]) {
  cachedPasswords = value;
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    void chrome.storage.local.set({ [STORAGE_KEY]: value });
  }
}

export function initializePasswordMetadataCache(
  onChange?: (value: PasswordMetadataDto[]) => void,
) {
  if (onChange) {
    listeners.add(onChange);
    onChange(cachedPasswords);
  }

  const cleanup = () => {
    if (onChange) listeners.delete(onChange);
  };

  if (typeof chrome === "undefined" || !chrome.storage?.local) return cleanup;

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const data = res?.[STORAGE_KEY];
    if (!Array.isArray(data)) return;
    cachedPasswords = data;
    listeners.forEach((listener) => listener(data));
  });

  if (isInitialized || !chrome.storage?.onChanged) return cleanup;
  isInitialized = true;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;

    const next = changes[STORAGE_KEY].newValue;
    if (!Array.isArray(next)) return;
    cachedPasswords = next;
    listeners.forEach((listener) => listener(next));
  });

  return cleanup;
}
