import { normalizeDomain } from './utils/domain';

const trackedForms = new WeakSet<HTMLFormElement>();

function getIdentifier(form: HTMLFormElement): string {
  const email = form.querySelector('input[type="email"]') as HTMLInputElement | null;
  if (email?.value) return email.value;

  const username = form.querySelector('input[name*="user" i], input[name*="login" i], input[name*="identifier" i]') as HTMLInputElement | null;
  if (username?.value) return username.value;

  const text = form.querySelector('input[type="text"]') as HTMLInputElement | null;
  return text?.value ?? '';
}

function attachListeners() {
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    if (trackedForms.has(form)) return;

    form.addEventListener('submit', () => {
      const passwordInput = form.querySelector('input[type="password"]') as HTMLInputElement | null;
      if (!passwordInput?.value) return;

      const payload = {
        type: 'MOSSY_CAPTURE_CREDENTIAL',
        identifier: getIdentifier(form),
        password: passwordInput.value,
        domain: normalizeDomain(window.location.hostname),
      };

      chrome.runtime.sendMessage(payload);
    });

    trackedForms.add(form);
  });
}

attachListeners();

const observer = new MutationObserver(() => {
  attachListeners();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
