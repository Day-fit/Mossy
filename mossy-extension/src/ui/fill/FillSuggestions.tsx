import { useState, type KeyboardEvent } from 'react';
import type { FillSuggestion } from '../../messaging/rpc';
import type { Theme } from '../../theme/types';

type FillSuggestionsProps = {
    suggestions: FillSuggestion[];
    theme: Theme;
    onSelect: (suggestion: FillSuggestion) => Promise<void>;
    onDismiss: () => void;
};

export default function FillSuggestions({
    suggestions,
    theme,
    onSelect,
    onDismiss,
}: FillSuggestionsProps) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(false);

    async function select(suggestion: FillSuggestion) {
        setSubmitting(true);

        try {
            await onSelect(suggestion);
        } catch {
            setSubmitting(false);
            setError(true);
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
            className="box-border max-h-[280px] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 font-sans text-sm leading-normal text-fg-primary shadow-card [--font-sans:system-ui,sans-serif]"
            role="group"
            aria-label="Mossy saved logins"
            onKeyDown={handleKeyDown}
        >
            <div
                className="px-2.5 py-2 text-xs font-semibold text-fg-muted"
                role={error ? 'alert' : undefined}
            >
                {error
                    ? 'Could not fill. Try again or open Mossy.'
                    : 'Fill with Mossy'}
            </div>

            {suggestions.map((suggestion) => (
                <button
                    key={`${suggestion.vaultId}:${suggestion.passwordId}`}
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
                        {suggestion.identifier || 'Saved login'}
                    </strong>

                    <span className="block truncate text-xs text-fg-muted">
                        {suggestion.vaultName}
                    </span>
                </button>
            ))}

            <div className="px-2.5 py-2 text-xs text-fg-muted">
                Choose a login to authorize filling.
            </div>
        </div>
    );
}
