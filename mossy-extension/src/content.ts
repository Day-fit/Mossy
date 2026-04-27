import { normalizeDomain } from "./utils/domain";

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

  return {
    identifier,
    password: password.value,
  };
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

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  tryCapture();
});
