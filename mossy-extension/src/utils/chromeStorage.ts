import type { CapturedCredential } from "../types";

const CAPTURED_KEY = "captured_credentials";
const SELECTED_VAULT_KEY = "selected_vault_id";

export async function loadCapturedCredentials(): Promise<CapturedCredential[]> {
  const result = await chrome.storage.local.get(CAPTURED_KEY);
  return (result[CAPTURED_KEY] as CapturedCredential[] | undefined) ?? [];
}

export async function saveCapturedCredentials(
  credentials: CapturedCredential[],
): Promise<void> {
  await chrome.storage.local.set({ [CAPTURED_KEY]: credentials });
}

export async function loadSelectedVaultId(): Promise<string | null> {
  const result = await chrome.storage.local.get(SELECTED_VAULT_KEY);
  return (result[SELECTED_VAULT_KEY] as string | undefined) ?? null;
}

export async function saveSelectedVaultId(
  vaultId: string | null,
): Promise<void> {
  if (vaultId) {
    await chrome.storage.local.set({ [SELECTED_VAULT_KEY]: vaultId });
  } else {
    await chrome.storage.local.remove(SELECTED_VAULT_KEY);
  }
}
