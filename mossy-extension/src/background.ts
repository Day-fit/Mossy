import type { CapturedCredential } from './types';

const KEY = 'captured_credentials';

async function getCaptured(): Promise<CapturedCredential[]> {
  const result = await chrome.storage.local.get(KEY);
  return (result[KEY] as CapturedCredential[] | undefined) ?? [];
}

async function saveCaptured(values: CapturedCredential[]) {
  await chrome.storage.local.set({ [KEY]: values });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'MOSSY_CAPTURE_CREDENTIAL') return;

  void (async () => {
    const current = await getCaptured();
    const entry: CapturedCredential = {
      id: crypto.randomUUID(),
      identifier: message.identifier ?? '',
      password: message.password ?? '',
      domain: message.domain ?? sender.tab?.url ?? '',
      createdAt: Date.now(),
    };

    const next = [entry, ...current].slice(0, 50);
    await saveCaptured(next);
    await chrome.action.setBadgeText({ text: next.length > 0 ? String(next.length) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#007735' });

    sendResponse({ ok: true });
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeText({ text: '' });
});
