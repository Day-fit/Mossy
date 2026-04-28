import type { CapturedCredential } from "./types";
import { decryptPassword } from "./utils/decryptPassword";
import { executeRefreshRequest } from "./api/auth.api";
import { executePasswordCiphertextRequest } from "./api/password.api";
import { tokenStorage } from "./auth/tokenStorage";

const KEY = "captured_credentials";
const REFRESH_ALARM = "mossy_token_refresh";
// Refresh interval in minutes (14 min — access tokens typically expire at 15 min)
const REFRESH_INTERVAL_MINUTES = 14;

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
  if (message?.type === "MOSSY_GET_CIPHERTEXT") {
    void (async () => {
      try {
        const data = await executePasswordCiphertextRequest(
          message.passwordId as string,
          message.vaultId as string,
        );
        sendResponse({ ok: true, ciphertext: data.ciphertext });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to fetch ciphertext",
        });
      }
    })();
    return true;
  }

  if (message?.type === "MOSSY_DECRYPT_PASSWORD") {
    void (async () => {
      try {
        const plaintext = await decryptPassword(
          message.ciphertext as string,
          message.vaultId as string,
          message.pin as string,
        );
        sendResponse({ ok: true, plaintext });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : "Decryption failed",
        });
      }
    })();
    return true;
  }

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
  void refreshAccessToken();
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(() => {
  void refreshAccessToken();
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void refreshAccessToken();
  }
});

async function refreshAccessToken() {
  try {
    const response = await executeRefreshRequest();
    const data = (await response.json()) as { accessToken?: string };
    if (data.accessToken) {
      await tokenStorage.set(data.accessToken);
    } else {
      await tokenStorage.set(null);
    }
  } catch {
    // Silently ignore — user may not be logged in yet
  }
}
