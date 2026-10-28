import { useState, type KeyboardEvent } from 'react';
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
            className="box-border max-h-70 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 font-sans text-sm leading-normal text-fg-primary shadow-card [--font-sans:system-ui,sans-serif]"
            role="group"
            aria-label={title}
            onKeyDown={handleKeyDown}
        >
            <div
                className="px-2.5 py-2 text-xs font-semibold text-fg-muted"
                role={error ? 'alert' : undefined}
            >
                {error || title}
            </div>

            {suggestions.map((suggestion) => (
                <button
                    key={suggestion.id}
                    type="button"
                    className="block w-full cursor-pointer rounded-lg border-0 bg-transparent px-2.5 py-2 text-left font-sans text-sm text-fg-primary hover:bg-surface-muted focus-visible:bg-surface-muted disabled:cursor-wait disabled:opacity-55"
                    disabled={submitting}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                        if (event.nativeEvent.isTrusted) {
                            void select(suggestion);
                        }
                    }}
                >
                    <strong className="block truncate font-semibold">
                        {suggestion.label}
                    </strong>

                    <span className="block truncate text-xs text-fg-muted">
                        {suggestion.description}
                    </span>
                </button>
            ))}

            <div className="px-2.5 py-2 text-xs text-fg-muted">{hint}</div>
        </div>
    );
}
