import { MdOpenInNew } from 'react-icons/md';
import {
    featureRequestUrl,
    projectIssuesUrl,
} from '../helpers/projectLinks.ts';
import { type ThemePreference, useThemeStore } from '../store/themeStore.ts';

const appearances: {
    value: ThemePreference;
    label: string;
    description: string;
}[] = [
    { value: 'system', label: 'System', description: 'Match your device' },
    { value: 'light', label: 'Light', description: 'Light surfaces' },
    { value: 'dark', label: 'Dark', description: 'Dark surfaces' },
];

export default function Settings() {
    const preference = useThemeStore((state) => state.preference);
    const setPreference = useThemeStore((state) => state.setPreference);
    const persistenceError = useThemeStore((state) => state.persistenceError);

    return (
        <div className="w-full px-4 py-5">
            <div className="mx-auto w-full max-w-4xl rounded-xl bg-surface p-6 shadow-card sm:p-8">
                <header className="mb-8">
                    <h1 className="text-3xl">Settings</h1>
                    <p className="mt-2 text-sm text-fg-muted">
                        Make Mossy feel right for you.
                    </p>
                </header>
                <section
                    aria-labelledby="appearance-heading"
                    className="border-t border-border py-6 sm:py-8"
                >
                    <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-10">
                        <div>
                            <h2 id="appearance-heading" className="text-xl">
                                Appearance
                            </h2>
                            <p
                                id="appearance-description"
                                className="mt-2 text-sm text-fg-muted"
                            >
                                Choose how Mossy looks on this browser.
                            </p>
                        </div>
                        <div>
                            <fieldset aria-describedby="appearance-description">
                                <legend className="sr-only">Theme</legend>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {appearances.map(
                                        ({ value, label, description }) => (
                                            <label
                                                key={value}
                                                className="flex min-h-24 cursor-pointer flex-col gap-2 rounded-md border border-border-strong bg-surface-subtle px-4 py-4 has-checked:border-fg-brand has-checked:bg-brand/5 focus-within:ring-2 focus-within:ring-fg-brand focus-within:ring-offset-2 focus-within:ring-offset-surface"
                                            >
                                                <span className="flex items-center justify-between gap-3 font-semibold">
                                                    {label}
                                                    <input
                                                        type="radio"
                                                        name="theme"
                                                        value={value}
                                                        aria-label={label}
                                                        aria-describedby={
                                                            'theme-' +
                                                            value +
                                                            '-description'
                                                        }
                                                        checked={
                                                            preference === value
                                                        }
                                                        onChange={() =>
                                                            setPreference(value)
                                                        }
                                                        className="h-4 w-4 cursor-pointer accent-brand"
                                                    />
                                                </span>
                                                <span
                                                    id={
                                                        'theme-' +
                                                        value +
                                                        '-description'
                                                    }
                                                    className="text-xs text-fg-muted"
                                                >
                                                    {description}
                                                </span>
                                            </label>
                                        )
                                    )}
                                </div>
                            </fieldset>
                            {persistenceError && (
                                <p
                                    role="status"
                                    className="mt-3 text-sm text-fg-danger"
                                >
                                    Applied for this visit. This browser
                                    couldn’t save your choice.
                                </p>
                            )}
                        </div>
                    </div>
                </section>
                <section
                    aria-labelledby="feedback-heading"
                    className="border-t border-border pt-6 sm:pt-8"
                >
                    <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-10">
                        <div>
                            <h2 id="feedback-heading" className="text-xl">
                                Missing something?
                            </h2>
                            <p className="mt-2 text-sm text-fg-muted">
                                More settings are coming.
                            </p>
                        </div>
                        <div>
                            <p className="max-w-lg text-fg-secondary">
                                Looking for a feature that isn’t here yet? Tell
                                us what you need and we’ll take a look.
                            </p>
                            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
                                <a
                                    href={projectIssuesUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-semibold text-fg-brand underline underline-offset-4"
                                >
                                    Browse issues{' '}
                                    <MdOpenInNew aria-hidden="true" />
                                </a>
                                <a
                                    href={featureRequestUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm font-semibold text-fg-brand underline underline-offset-4"
                                >
                                    Request a feature{' '}
                                    <MdOpenInNew aria-hidden="true" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
