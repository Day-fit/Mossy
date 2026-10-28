import { nanoid } from 'nanoid';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { isWebsiteProtocol } from '../security/website';
import { messaging } from '../messaging/rpc';
import { registerSuggestions } from './registerSuggestions';
import { eligible, fillInputs, readForm, type PasswordForm } from './forms';

export function registerCapture(ctx: ContentScriptContext) {
    try {
        const isIneligiblePage =
            !isWebsiteProtocol(location.protocol) ||
            window.top!.location.origin !== location.origin;
        if (isIneligiblePage) {
            return;
        }
    } catch {
        return;
    }

    const cleanAutofill = new WeakSet<HTMLFormElement>();
    const forms = new Map<string, PasswordForm>();
    const ids = new WeakMap<Element, string>();

    const id = (element: Element) => {
        let value = ids.get(element);

        if (!value) {
            value = nanoid();
            ids.set(element, value);
        }

        return value;
    };

    function discover() {
        forms.clear();

        for (const form of document.forms) {
            const record = readForm(form);

            if (record) forms.set(id(form), record);
        }

        return messaging.sendMessage('handleDiscover', {
            forms: [...forms].slice(0, 30).map(([formId, value]) => ({
                formId,
                passwordId: id(value.password),
                usernameId: value.username ? id(value.username) : null,
                origin: location.origin,
            })),
        });
    }

    const publishDiscovery = () => void discover().catch(() => undefined);
    const unsubscribeDiscovery = messaging.onMessage(
        'rediscoverForms',
        async ({ sender }) => {
            if (sender.id !== chrome.runtime.id || sender.tab)
                return { status: 'error' };
            await discover();
            return { status: 'ok' };
        }
    );

    ctx.addEventListener(
        document,
        'input',
        (event) => {
            const isFormInput =
                event.target instanceof HTMLInputElement && event.target.form;
            if (isFormInput) {
                cleanAutofill.delete(event.target.form);
            }
        },
        true
    );

    let interaction = 0;
    ctx.addEventListener(
        document,
        'pointerdown',
        (event) => {
            if (event.isTrusted) {
                interaction = performance.now();
            }
        },
        true
    );
    ctx.addEventListener(
        document,
        'keydown',
        (event) => {
            if (event.isTrusted) {
                interaction = performance.now();
            }
        },
        true
    );
    ctx.addEventListener(
        document,
        'submit',
        (event) => {
            const shouldIgnoreSubmission =
                !event.isTrusted ||
                performance.now() - interaction > 2000 ||
                !(event.target instanceof HTMLFormElement);
            if (shouldIgnoreSubmission) {
                return;
            }

            const form = event.target;

            if (cleanAutofill.has(form)) {
                return;
            }

            const record = readForm(form);

            if (!record) return;

            const { passwords, username } = record;
            const field =
                passwords.find(
                    (input) => input.autocomplete === 'new-password'
                ) ?? passwords[0];

            if (!field?.value) {
                return;
            }

            const hasMismatchedNewPasswords = passwords
                .filter((input) => input.autocomplete === 'new-password')
                .some((input) => input.value !== field.value);
            if (hasMismatchedNewPasswords) {
                return;
            }

            if (!username?.value) {
                return;
            }

            // Read only during this user submission. Never watch or retain typed passwords.
            void messaging
                .sendMessage('handleCapture', {
                    identifier: username.value,
                    password: field.value,
                    origin: location.origin,
                })
                .catch(() => undefined);
        },
        true
    );

    function selected(target: {
        formId: string;
        passwordId: string;
        usernameId: string | null;
        origin: string;
    }) {
        const record = forms.get(target.formId);

        const isInvalidTarget =
            !record ||
            location.origin !== target.origin ||
            !record.form.isConnected ||
            !record.password.isConnected ||
            record.password.form !== record.form ||
            record.password.type !== 'password' ||
            !eligible(record.password) ||
            id(record.password) !== target.passwordId ||
            (record.username ? id(record.username) : null) !==
                target.usernameId ||
            (record.username &&
                (!record.username.isConnected ||
                    record.username.form !== record.form ||
                    !eligible(record.username)));
        if (isInvalidTarget) {
            return;
        }

        try {
            const isCrossOriginFrame =
                window.top!.location.origin !== location.origin;
            if (isCrossOriginFrame) {
                return;
            }
        } catch {
            return;
        }

        return record;
    }

    const dismissSuggestions = registerSuggestions(ctx, forms, discover);
    const filled = new Set<string>();
    const unsubscribe = messaging.onMessage(
        'fillOnce',
        ({ data: message, sender }) => {
            const shouldIgnoreMessage =
                sender.id !== chrome.runtime.id || sender.tab;
            if (shouldIgnoreMessage) {
                return { valid: false };
            }

            const record = selected(message.target ?? {});

            if (!record) {
                return { valid: false };
            }

            const isInvalidFillRequest =
                typeof message.actionId !== 'string' ||
                filled.has(message.actionId) ||
                typeof message.password !== 'string' ||
                typeof message.identifier !== 'string';
            if (isInvalidFillRequest) {
                return { valid: false };
            }

            filled.add(message.actionId);

            const values: [HTMLInputElement, string][] = [
                [record.password, message.password],
            ];

            if (record.username)
                values.unshift([record.username, message.identifier]);

            fillInputs(values);

            cleanAutofill.add(record.form);
            dismissSuggestions();
            message.password = '';
            return { valid: true };
        }
    );
    publishDiscovery();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(publishDiscovery, 200);
    });
    observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
            'type',
            'disabled',
            'readonly',
            'hidden',
            'style',
            'class',
        ],
    });
    ctx.onInvalidated(() => {
        unsubscribe();
        unsubscribeDiscovery();
        observer.disconnect();
        clearTimeout(timer);
        forms.clear();
        filled.clear();
    });
}
