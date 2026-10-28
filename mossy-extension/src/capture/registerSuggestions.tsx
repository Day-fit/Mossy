import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { messaging, type MessageStatus } from '../messaging/rpc';
import type { Theme } from '../theme/types';
import FieldSuggestions, { type Suggestion } from '../ui/fill/FieldSuggestions';
import type { PasswordForm } from './forms';
import { fillGeneratedPassword } from '../password-generation/fillGeneratedPassword';
import styles from '../globals.css?inline';
import syneRegular from '@fontsource/syne/files/syne-latin-400-normal.woff2?inline';
import syneSemibold from '@fontsource/syne/files/syne-latin-600-normal.woff2?inline';
import geologica from '@fontsource/geologica/files/geologica-latin-500-normal.woff2?inline';

export function registerSuggestions(
    ctx: ContentScriptContext,
    forms: Map<string, PasswordForm>,
    discover: () => Promise<MessageStatus>
) {
    const fonts = [
        ['Mossy Syne', syneRegular, '400'],
        ['Mossy Syne', syneSemibold, '600'],
        ['Mossy Geologica', geologica, '500'],
    ] as const;
    const fontsReady = Promise.all(
        fonts.map(([family, source, weight]) => {
            const bytes = Uint8Array.from(
                atob(source.split(',')[1]!),
                (character) => character.charCodeAt(0)
            );
            const font = new FontFace(family, bytes, { weight });

            document.fonts.add(font);
            ctx.onInvalidated(() => document.fonts.delete(font));

            return font.load();
        })
    ).catch(() => undefined);

    let panel:
        | { host: HTMLElement; root: Root; shadow: ShadowRoot }
        | undefined;
    let anchor: HTMLInputElement | undefined;
    let restoreFocus = false;

    function dismiss() {
        panel?.root.unmount();
        panel?.host.remove();

        panel = undefined;
        anchor = undefined;
    }

    function dismissAndRestoreFocus() {
        const previous = anchor;

        dismiss();

        restoreFocus = true;
        previous?.focus({ preventScroll: true });
        restoreFocus = false;
    }

    function position() {
        if (!panel || !anchor) return;

        const { host } = panel;
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
        suggestions: Suggestion[],
        title: string,
        hint: string,
        theme: Theme
    ) {
        dismiss();

        anchor = field;
        const host = document.createElement('mossy-fill-suggestions');

        host.popover = 'manual';
        host.style.cssText =
            'all:initial!important;position:fixed!important;inset:auto;margin:0;padding:0;border:0;background:transparent;overflow:visible;';
        const shadow = host.attachShadow({ mode: 'closed' });

        const ui = createRoot(shadow);
        panel = { host, root: ui, shadow };

        flushSync(() =>
            ui.render(
                <>
                    <style>
                        {styles.replaceAll(':root', '[data-mossy-theme-root]')}
                    </style>

                    <FieldSuggestions
                        title={title}
                        hint={hint}
                        suggestions={suggestions}
                        theme={theme}
                        onDismiss={dismissAndRestoreFocus}
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
            if (restoreFocus || event.target === panel?.host) return;

            const field = event.target;

            dismiss();

            if (!(field instanceof HTMLInputElement) || !event.isTrusted)
                return;

            anchor = field;

            void (async () => {
                await Promise.all([discover(), fontsReady]);

                const match = [...forms].find(
                    ([, form]) =>
                        form.username === field ||
                        form.password === field ||
                        (field.autocomplete === 'new-password' &&
                            form.passwords.includes(field))
                );

                if (!match) return dismiss();

                const [formId, form] = match;
                const generating =
                    field.type === 'password' &&
                    field.autocomplete === 'new-password';
                let suggestions: Suggestion[];
                let theme: Theme;

                if (generating) {
                    theme = await messaging.sendMessage('getGenerationTheme');
                    suggestions = [
                        {
                            id: 'generate',
                            label: 'Generate password',
                            description: 'Create a strong password',
                            select: () => {
                                fillGeneratedPassword(field);
                                dismiss();
                            },
                        },
                    ];
                } else {
                    if (form.password.autocomplete === 'new-password')
                        return dismiss();

                    const result = await messaging.sendMessage(
                        'getFillSuggestions',
                        { formId }
                    );
                    theme = result.theme;
                    suggestions = result.suggestions.map((suggestion) => ({
                        id: `${suggestion.vaultId}:${suggestion.passwordId}`,
                        label: suggestion.identifier || 'Saved login',
                        description: suggestion.vaultName,
                        select: async () => {
                            await messaging.sendMessage('handleSuggestedFill', {
                                formId,
                                vaultId: suggestion.vaultId,
                                passwordId: suggestion.passwordId,
                            });
                            dismiss();
                        },
                    }));
                }

                if (document.activeElement !== field) return;

                if (suggestions.length) {
                    show(
                        field,
                        suggestions,
                        generating ? 'Create with Mossy' : 'Fill with Mossy',
                        generating
                            ? 'Fills your new password fields.'
                            : 'Choose a login to authorize filling.',
                        theme
                    );
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
                document.activeElement !== panel?.host
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
                (!panel || !event.composedPath().includes(panel.host))
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
                if (panel) event.preventDefault();

                dismiss();
            } else if (panel && event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();

                panel.shadow
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
