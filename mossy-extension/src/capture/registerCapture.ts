import type { ContentScriptContext } from 'wxt/utils/content-script-context';

export function registerCapture(ctx: ContentScriptContext) {
    try {
        const isIneligiblePage =
            location.protocol !== 'https:' ||
            window.top!.location.origin !== location.origin;
        if (isIneligiblePage) {
            return;
        }
    } catch {
        return;
    }

    const cleanAutofill = new WeakSet<HTMLFormElement>();
    const forms = new Map<
        string,
        {
            form: HTMLFormElement;
            password: HTMLInputElement;
            username: HTMLInputElement | null;
            passwordId: string;
            usernameId: string | null;
        }
    >();
    const ids = new WeakMap<Element, string>();

    const id = (element: Element) => {
        let value = ids.get(element);

        if (!value) {
            value = crypto.randomUUID();
            ids.set(element, value);
        }

        return value;
    };

    const eligible = (field: HTMLInputElement) =>
        !field.disabled &&
        !field.readOnly &&
        field.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
        }) &&
        field.type !== 'hidden';

    function discover() {
        forms.clear();

        for (const form of document.forms) {
            const password = Array.from(
                form.querySelectorAll<HTMLInputElement>(
                    'input[type="password"]'
                )
            ).find(eligible);

            if (!password) {
                continue;
            }

            const username =
                Array.from(form.querySelectorAll<HTMLInputElement>('input'))
                    .filter(eligible)
                    .find(
                        (input) =>
                            ['username', 'email'].includes(
                                input.autocomplete
                            ) || ['email', 'text', 'tel'].includes(input.type)
                    ) ?? null;
            const formId = id(form);
            forms.set(formId, {
                form,
                password,
                username,
                passwordId: id(password),
                usernameId: username ? id(username) : null,
            });
        }

        void chrome.runtime
            .sendMessage({
                kind: 'discover',
                forms: [...forms].slice(0, 30).map(([formId, value]) => ({
                    formId,
                    passwordId: value.passwordId,
                    usernameId: value.usernameId,
                    origin: location.origin,
                })),
            })
            .catch(() => undefined);
    }

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

            const passwords = Array.from(
                form.querySelectorAll<HTMLInputElement>(
                    'input[type="password"]'
                )
            ).filter(eligible);
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

            const username = Array.from(
                form.querySelectorAll<HTMLInputElement>('input')
            )
                .filter(eligible)
                .find(
                    (input) =>
                        ['username', 'email'].includes(input.autocomplete) ||
                        ['email', 'text', 'tel'].includes(input.type)
                );

            if (!username?.value) {
                return;
            }

            // Read only during this user submission. Never watch or retain typed passwords.
            void chrome.runtime
                .sendMessage({
                    kind: 'capture',
                    formId: id(form),
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
            record.usernameId !== target.usernameId ||
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

    const filled = new Set<string>();
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        const shouldIgnoreMessage =
            sender.id !== chrome.runtime.id ||
            sender.tab ||
            !['validate-fill', 'fill-once'].includes(message?.kind);
        if (shouldIgnoreMessage) {
            return;
        }

        const record = selected(message.target ?? {});

        if (!record) {
            respond({ valid: false });

            return;
        }

        if (message.kind === 'validate-fill') {
            respond({ valid: true });

            return;
        }

        const isInvalidFillRequest =
            typeof message.actionId !== 'string' ||
            filled.has(message.actionId) ||
            typeof message.password !== 'string' ||
            typeof message.identifier !== 'string';
        if (isInvalidFillRequest) {
            respond({ valid: false });

            return;
        }

        filled.add(message.actionId);

        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        )!.set!;

        // Both values are written before events, with no automatic submit.
        if (record.username) {
            setter.call(record.username, message.identifier);
        }

        setter.call(record.password, message.password);

        for (const input of [record.username, record.password]) {
            if (input) {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        cleanAutofill.add(record.form);
        message.password = '';
        respond({ valid: true });
    });
    discover();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(discover, 200);
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
        observer.disconnect();
        clearTimeout(timer);
        forms.clear();
        filled.clear();
    });
}
