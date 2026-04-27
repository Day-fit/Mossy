import { normalizeDomain } from "./utils/domain";
import { usePasswordsStore } from "./store/passwordsStore.ts";
import { executeRefreshRequest } from "./api/auth.api.ts";
import { executePasswordCiphertextRequest } from "./api/password.api.ts";
import { loadSelectedVaultId } from "./utils/chromeStorage.ts";
import { tokenStorage } from "./auth/tokenStorage.ts";

const getPasswords = usePasswordsStore.getState().getPasswords;
let suggestionElement: HTMLElement | null = null;

type CapturePayload = {
  type: "MOSSY_CAPTURE_CREDENTIAL";
  identifier: string;
  password: string;
  domain: string;
};

let lastCaptureHash = "";

refreshAccessToken().catch(console.error);
setTimeout(async () => {
  await refreshAccessToken();
}, 840000);

async function refreshAccessToken() {
  const response = await executeRefreshRequest().then((response) =>
    response.json(),
  );

  tokenStorage.set(response.accessToken);
}

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
      const password = inputs.find((i) => i.type === "password");

      const identifier =
        inputs.find((i) => i.type === "email") ||
        inputs.find((i) => /user|login|identifier/i.test(i.name)) ||
        inputs.find((i) => i.type === "text");

      if (!identifier || !password) return;

      root.remove();
      suggestionElement = null;

      const vaultId = await loadSelectedVaultId();

      if (!vaultId) return;

      const response = await executePasswordCiphertextRequest(
        s.passwordId,
        vaultId,
      );

      identifier.value = s.identifier;
      identifier.dispatchEvent(new Event("input", { bubbles: true }));
      password.value = response.ciphertext;
      password.dispatchEvent(new Event("input", { bubbles: true }));
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
