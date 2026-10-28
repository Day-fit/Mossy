import { useState, type KeyboardEvent } from 'react';
import { MdArrowForward, MdPassword } from 'react-icons/md';
import type { Theme } from '../../theme/types';

export type Suggestion = {
    id: string;
    label: string;
    description: string;
    select: () => void | Promise<void>;
};

type FieldSuggestionsProps = {
    title: string;
    hint: string;
    suggestions: Suggestion[];
    theme: Theme;
    onDismiss: () => void;
};

export default function FieldSuggestions({
    title,
    hint,
    suggestions,
    theme,
    onDismiss,
}: FieldSuggestionsProps) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    async function select(suggestion: Suggestion) {
        setSubmitting(true);

        try {
            await suggestion.select();
        } catch (cause) {
            setSubmitting(false);
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Could not complete this action. Try again.'
            );
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!event.nativeEvent.isTrusted) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onDismiss();

            return;
        }

        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        if (!(event.target instanceof HTMLButtonElement)) return;

        event.preventDefault();

        const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button')
        );
        const index = buttons.indexOf(event.target);
        const direction = event.key === 'ArrowDown' ? 1 : -1;

        buttons[(index + direction + buttons.length) % buttons.length]?.focus();
    }

    return (
        <div
            data-mossy-theme-root=""
            data-theme={theme}
            className="box-border max-h-70 overflow-y-auto rounded-xl border border-solid border-border-strong bg-surface font-sans text-sm leading-normal text-fg-primary [--font-sans:'Mossy_Syne',sans-serif] [--font-heading:'Mossy_Geologica',sans-serif]"
            role="group"
            aria-label={title}
            onKeyDown={handleKeyDown}
        >
            <div className="flex items-center justify-between gap-3 border-b border-solid border-border px-3 py-2.5">
                <span className="font-heading font-medium text-fg-brand">
                    {title}
                </span>

                <kbd
                    className="rounded border border-solid border-border bg-surface-subtle px-1 py-0.5 font-sans text-xs leading-none text-fg-muted"
                    aria-hidden="true"
                >
                    Esc
                </kbd>
            </div>

            <div className="space-y-1 p-1.5">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.id}
                        type="button"
                        className="group flex min-h-14 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-solid border-transparent bg-transparent px-2.5 py-2 text-left font-sans text-sm text-fg-primary hover:border-border hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-fg-brand focus-visible:outline-offset-[-2px] disabled:cursor-wait disabled:opacity-55"
                        disabled={submitting}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                            if (event.nativeEvent.isTrusted) {
                                void select(suggestion);
                            }
                        }}
                    >
                        <MdPassword
                            className="shrink-0 text-fg-muted"
                            size={18}
                            aria-hidden="true"
                        />

                        <span className="min-w-0 flex-1">
                            <strong
                                className="block truncate font-semibold"
                                title={suggestion.label}
                            >
                                {suggestion.label}
                            </strong>

                            <span
                                className="block truncate text-xs text-fg-muted"
                                title={suggestion.description}
                            >
                                {suggestion.description}
                            </span>
                        </span>

                        <MdArrowForward
                            className="shrink-0 text-fg-muted group-hover:text-fg-brand group-focus-visible:text-fg-brand"
                            size={16}
                            aria-hidden="true"
                        />
                    </button>
                ))}
            </div>

            <p
                className={`border-t border-solid border-border px-3 py-2 text-xs leading-relaxed ${error ? 'text-fg-danger' : 'text-fg-muted'}`}
                role={error ? 'alert' : undefined}
            >
                {error || hint}
            </p>
        </div>
    );
}
