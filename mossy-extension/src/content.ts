import { normalizeDomain } from "./utils/domain";
import { usePasswordsStore } from "./store/passwordsStore.ts";
import { loadSelectedVaultId } from "./utils/chromeStorage.ts";

const getPasswords = usePasswordsStore.getState().getPasswords;
let suggestionElement: HTMLElement | null = null;

type CapturePayload = {
  type: "MOSSY_CAPTURE_CREDENTIAL";
  identifier: string;
  password: string;
  domain: string;
};

let lastCaptureHash = "";

function getInputs() {
  const inputs = Array.from(document.querySelectorAll("input"));
  const password = inputs.find((i) => i.type === "password") as
    | HTMLInputElement
    | undefined;

  if (!password?.value) return null;

  const identifier =
    inputs.find((i) => i.type === "email")?.value ||
    inputs.find((i) => /user|login|identifier/i.test(i.name))?.value ||
    inputs.find((i) => i.type === "text")?.value ||
    "";

  return { identifier, password: password.value };
}

function hashPayload(identifier: string, password: string, domain: string) {
  return `${identifier}|${password}|${domain}`;
}

function tryCapture() {
  const data = getInputs();
  if (!data) return;

  const domain = normalizeDomain(window.location.hostname);
  const hash = hashPayload(data.identifier, data.password, domain);

  if (hash === lastCaptureHash) return;
  lastCaptureHash = hash;

  const payload: CapturePayload = {
    type: "MOSSY_CAPTURE_CREDENTIAL",
    identifier: data.identifier,
    password: data.password,
    domain,
  };

  chrome.runtime.sendMessage(payload, () => {
    if (chrome.runtime.lastError) {
      console.error("Capture error:", chrome.runtime.lastError);
    }
  });
}

const PIN_LENGTH = 4;

// ── In-memory PIN cache (lives for the lifetime of this content script) ───────

const pinCache = new Map<string, string>();

function getCachedPin(vaultId: string): string | null {
  return pinCache.get(vaultId) ?? null;
}

function cachePin(vaultId: string, pin: string): void {
  pinCache.set(vaultId, pin);
}

// ── In-page PIN modal (Shadow DOM) ───────────────────────────────────────────

function showInPagePinModal(): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 28px 24px 22px;
          width: 300px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        h3 { margin: 0; font-size: 17px; font-weight: 600; color: #111; }
        p  { margin: 0; font-size: 13px; color: #666; }
        input {
          border: 1.5px solid #ddd;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 22px;
          letter-spacing: 10px;
          text-align: center;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        input:focus { border-color: #007735; }
        .buttons { display: flex; gap: 8px; }
        .btn-primary {
          flex: 1;
          padding: 9px;
          background: #007735;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }
        .btn-primary:hover { background: #006029; }
        .btn-secondary {
          flex: 1;
          padding: 9px;
          background: transparent;
          color: #555;
          border: 1.5px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-secondary:hover { background: #f5f5f5; }
        .error { font-size: 12px; color: #c0392b; text-align: center; }
      </style>
      <div class="overlay">
        <div class="card">
          <h3 id="pin-modal-title">Enter Vault PIN</h3>
          <p>Enter your 4-digit PIN to fill credentials.</p>
          <input type="password" inputmode="numeric" maxlength="4" id="pin" autocomplete="off" aria-labelledby="pin-modal-title" />
          <div class="buttons">
            <button class="btn-primary" id="submit">Fill</button>
            <button class="btn-secondary" id="cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(host);

    function cleanup() {
      host.remove();
    }

    const pinInput = shadow.getElementById("pin") as HTMLInputElement;
    // requestAnimationFrame ensures the shadow DOM is painted before we focus
    requestAnimationFrame(() => pinInput.focus());

    function submit() {
      if (pinInput.value.length !== PIN_LENGTH) return;
      const pin = pinInput.value;
      cleanup();
      resolve(pin);
    }

    const submitBtn = shadow.getElementById("submit");
    const cancelBtn = shadow.getElementById("cancel");
    const overlay = shadow.querySelector(".overlay");

    if (!submitBtn || !cancelBtn || !overlay) {
      cleanup();
      resolve(null);
      return;
    }

    submitBtn.addEventListener("click", submit);

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

// ── Decrypt & fill helpers ───────────────────────────────────────────────────

type DecryptResponse =
  | { ok: true; plaintext: string }
  | { ok: false; error: string };

async function decryptViaBackground(
  ciphertext: string,
  vaultId: string,
  pin: string,
): Promise<DecryptResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "MOSSY_DECRYPT_PASSWORD", ciphertext, vaultId, pin },
      (response: DecryptResponse) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message ?? "Runtime error" });
        } else {
          resolve(response);
        }
      },
    );
  });
}

type CiphertextResponse =
  | { ok: true; ciphertext: string }
  | { ok: false; error: string };

async function fetchCiphertextViaBackground(
  passwordId: string,
  vaultId: string,
): Promise<CiphertextResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "MOSSY_GET_CIPHERTEXT", passwordId, vaultId },
      (response: CiphertextResponse) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message ?? "Runtime error" });
        } else {
          resolve(response);
        }
      },
    );
  });
}

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  const isSubmit =
    target.closest('button[type="submit"]') ||
    target.closest('input[type="submit"]') ||
    target.closest("button:not([type])");

  if (!isSubmit) return;
  tryCapture();
});

function isAuthInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const input = target.closest("input") as HTMLInputElement | null;
  if (!input) return false;

  return (
    input.type === "password" ||
    input.type === "email" ||
    input.type === "text" ||
    /user|login|identifier/i.test(input.name) ||
    /user|login|identifier/i.test(input.id)
  );
}

function suggestFill(target: EventTarget) {
  if (suggestionElement) {
    suggestionElement.remove();
    suggestionElement = null;
  }

  const suggestions = getPasswords();
  if (!(target instanceof HTMLElement)) return;

  const hostname = window.location.hostname;
  const filtered = suggestions.filter((s) => s.domain === hostname);
  if (!filtered.length) return;

  const root = document.createElement("div");
  suggestionElement = root;

  root.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  Object.assign(root.style, {
    position: "absolute",
    top: `${target.getBoundingClientRect().bottom + window.scrollY}px`,
    left: `${target.getBoundingClientRect().left + window.scrollX}px`,
    width: `${target.getBoundingClientRect().width}px`,
    background: "#1e1e1e",
    border: "1px solid #333",
    borderRadius: "8px",
    overflow: "hidden",
    zIndex: "9999",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    fontFamily: "sans-serif",
  });

  filtered.forEach((s) => {
    const item = document.createElement("div");

    item.textContent = s.identifier;
    item.dataset.passwordId = s.passwordId;

    Object.assign(item.style, {
      padding: "10px 12px",
      cursor: "pointer",
      color: "#e5e5e5",
      fontSize: "14px",
      transition: "background 120ms ease",
    });

    item.addEventListener("mouseenter", () => {
      item.style.background = "#2a2a2a";
    });

    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
    });

    item.addEventListener("click", async () => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const passwordInput = inputs.find((i) => i.type === "password");

      const identifierInput =
        inputs.find((i) => i.type === "email") ||
        inputs.find((i) => /user|login|identifier/i.test(i.name)) ||
        inputs.find((i) => i.type === "text");

      if (!identifierInput || !passwordInput) return;

      root.remove();
      suggestionElement = null;

      const vaultId = await loadSelectedVaultId();
      if (!vaultId) return;

      // Fetch ciphertext via background service worker (avoids CORS + storage restrictions)
      const ciphertextResult = await fetchCiphertextViaBackground(
        s.passwordId,
        vaultId,
      );

      if (!ciphertextResult.ok) {
        console.error("Mossy: failed to fetch ciphertext —", ciphertextResult.error);
        return;
      }

      // Retrieve PIN — from in-memory cache or by prompting the user in the host page
      let pin = getCachedPin(vaultId);
      if (!pin) {
        pin = await showInPagePinModal();
        if (!pin) return;
      }

      // Decrypt via background service worker (has access to IDB + libsodium)
      const result = await decryptViaBackground(ciphertextResult.ciphertext, vaultId, pin);

      if (!result.ok) {
        console.error("Mossy: decryption failed —", result.error);
        return;
      }

      // Cache the validated PIN for subsequent fills in this session
      cachePin(vaultId, pin);

      // Fill the form fields
      identifierInput.value = s.identifier;
      identifierInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.value = result.plaintext;
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    root.appendChild(item);
  });

  document.body.appendChild(root);
}

document.addEventListener("focusin", (e) => {
  if (e?.target === null) return;
  if (!isAuthInput(e.target)) return;
  suggestFill(e.target);
});

document.addEventListener("focusout", (e) => {
  if (e?.target === null) return;
  if (!isAuthInput(e.target)) return;
  if (suggestionElement) suggestionElement.remove();
  suggestionElement = null;
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  tryCapture();
});

