import type { CapturedCredential } from '../types';

const CAPTURED_KEY = 'captured_credentials';

export async function loadCapturedCredentials(): Promise<CapturedCredential[]> {
  const result = await chrome.storage.local.get(CAPTURED_KEY);
  return (result[CAPTURED_KEY] as CapturedCredential[] | undefined) ?? [];
}

export async function saveCapturedCredentials(credentials: CapturedCredential[]): Promise<void> {
  await chrome.storage.local.set({ [CAPTURED_KEY]: credentials });
}
