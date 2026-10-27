import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { messaging, type FillSuggestion } from '../messaging/rpc';
import type { Theme } from '../theme/types';
import FillSuggestions from '../ui/fill/FillSuggestions';
import styles from '../globals.css?inline';

export type LoginForm = {
    form: HTMLFormElement;
    password: HTMLInputElement;
    username: HTMLInputElement | null;
    passwordId: string;
    usernameId: string | null;
};

export function registerFillSuggestions(
    ctx: ContentScriptContext,
    forms: Map<string, LoginForm>,
    discover: () => Promise<unknown>
) {
    let host: HTMLElement | undefined;
    let anchor: HTMLInputElement | undefined;
    let root: Root | undefined;
    let shadow: ShadowRoot | undefined;
    let restoreFocus = false;

    function dismiss() {
        root?.unmount();
        host?.remove();

        root = undefined;
        host = undefined;
        anchor = undefined;
        shadow = undefined;
    }

    function dismissAndRestoreFocus() {
        const previous = anchor;

        dismiss();

        restoreFocus = true;
        previous?.focus({ preventScroll: true });
        restoreFocus = false;
    }

    function position() {
        if (!host || !anchor) return;
        if (!anchor.isConnected || !anchor.checkVisibility()) return dismiss();

        const rect = anchor.getBoundingClientRect();
        const width = Math.min(Math.max(rect.width, 280), innerWidth - 16);

        host.style.setProperty('width', `${width}px`, 'important');
        host.style.setProperty(
            'left',
            `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`,
            'important'
        );

        const height = host.getBoundingClientRect().height;
        const below = rect.bottom + 6;

        host.style.setProperty(
            'top',
            `${
                below + height <= innerHeight - 8
                    ? below
                    : Math.max(8, rect.top - height - 6)
            }px`,
            'important'
        );
    }

    function show(
        field: HTMLInputElement,
        formId: string,
        suggestions: FillSuggestion[],
        theme: Theme
    ) {
        dismiss();

        anchor = field;
        host = document.createElement('mossy-fill-suggestions');

        host.popover = 'manual';
        host.style.cssText =
            'all:initial!important;position:fixed!important;inset:auto;margin:0;padding:0;border:0;background:transparent;overflow:visible;';
        shadow = host.attachShadow({ mode: 'closed' });

        const ui = createRoot(shadow);
        root = ui;

        flushSync(() =>
            ui.render(
                <>
                    <style>
                        {styles.replaceAll(':root', '[data-mossy-theme-root]')}
                    </style>

                    <FillSuggestions
                        suggestions={suggestions}
                        theme={theme}
                        onDismiss={dismissAndRestoreFocus}
                        onSelect={async (suggestion) => {
                            await messaging.sendMessage('handleSuggestedFill', {
                                formId,
                                vaultId: suggestion.vaultId,
                                passwordId: suggestion.passwordId,
                            });

                            dismiss();
                        }}
                    />
                </>
            )
        );

        document.documentElement.append(host);
        host.showPopover();
        position();
    }

    ctx.addEventListener(
        document,
        'focusin',
        (event) => {
            if (restoreFocus || event.target === host) return;

            const field = event.target;

            dismiss();

            if (!(field instanceof HTMLInputElement) || !event.isTrusted)
                return;

            anchor = field;

            void (async () => {
                await discover();

                const match = [...forms].find(
                    ([, form]) =>
                        (form.username === field || form.password === field) &&
                        form.password.autocomplete !== 'new-password'
                );

                if (!match) return dismiss();

                const [formId] = match;
                const result = await messaging.sendMessage(
                    'getFillSuggestions',
                    { formId }
                );

                if (document.activeElement !== field) return;

                if (result.suggestions.length) {
                    show(field, formId, result.suggestions, result.theme);
                } else {
                    dismiss();
                }
            })().catch(() => undefined);
        },
        true
    );

    ctx.addEventListener(document, 'focusout', () => {
        queueMicrotask(() => {
            if (
                anchor &&
                document.activeElement !== anchor &&
                document.activeElement !== host
            ) {
                dismiss();
            }
        });
    });

    ctx.addEventListener(
        document,
        'pointerdown',
        (event) => {
            if (
                anchor &&
                event.target !== anchor &&
                (!host || !event.composedPath().includes(host))
            ) {
                dismiss();
            }
        },
        true
    );

    ctx.addEventListener(
        document,
        'keydown',
        (event) => {
            if (!(event instanceof KeyboardEvent)) return;
            if (event.target !== anchor || !event.isTrusted) return;

            if (event.key === 'Escape') {
                if (host) event.preventDefault();

                dismiss();
            } else if (host && event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();

                shadow
                    ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
                    ?.focus();
            }
        },
        true
    );

    ctx.addEventListener(window, 'scroll', position, true);
    ctx.addEventListener(window, 'resize', position);
    ctx.addEventListener(window, 'blur', dismiss);
    ctx.onInvalidated(dismiss);

    return dismiss;
}
