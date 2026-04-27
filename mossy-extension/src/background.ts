import type { CapturedCredential } from "./types";

const KEY = "captured_credentials";

async function getCaptured(): Promise<CapturedCredential[]> {
  const result = await chrome.storage.local.get(KEY);
  return (result[KEY] as CapturedCredential[] | undefined) ?? [];
}

async function saveCaptured(values: CapturedCredential[]) {
  await chrome.storage.local.set({ [KEY]: values });
}

function normalizeUrl(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MOSSY_CAPTURE_CREDENTIAL") return;

  void (async () => {
    try {
      const current = await getCaptured();

      const entry: CapturedCredential = {
        id: crypto.randomUUID(),
        identifier: message.identifier ?? "",
        password: message.password ?? "",
        domain: message.domain || normalizeUrl(sender.tab?.url),
        createdAt: Date.now(),
      };

      const isDuplicate = current.some(
        (c) =>
          c.identifier === entry.identifier &&
          c.password === entry.password &&
          c.domain === entry.domain,
      );

      if (isDuplicate) {
        sendResponse({ ok: true, skipped: true });
        return;
      }

      const next = [entry, ...current].slice(0, 50);

      await saveCaptured(next);

      await chrome.action.setBadgeText({
        text: next.length > 0 ? String(next.length) : "",
      });

      await chrome.action.setBadgeBackgroundColor({
        color: "#007735",
      });

      sendResponse({ ok: true });
    } catch (e) {
      console.error("Background error:", e);
      sendResponse({ ok: false });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
