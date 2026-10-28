import { Button } from '@mossy/ui';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import {
    MdCheckCircle,
    MdDarkMode,
    MdExpandMore,
    MdLightMode,
    MdMonitor,
    MdWarningAmber,
} from 'react-icons/md';
import { usePopupSettings } from './usePopupSettings';
import type { Theme } from '../../theme/types';
import type { PopupView, RunPopupTask } from './types';
import { motion, useReducedMotion } from 'framer-motion';

type PopupSettingsProps = {
    view: Pick<PopupView, 'instance' | 'permission'>;
    loading: boolean;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    run: RunPopupTask;
    onSaved: () => void;
    onError: (message: string) => void;
};

export default function PopupSettings({
    view,
    loading,
    theme,
    onThemeChange,
    run,
    onSaved,
    onError,
}: PopupSettingsProps) {
    const { savingTheme, saveSettings, saveTheme, enableWebsiteAccess } =
        usePopupSettings({ run, onSaved, onError, theme, onThemeChange });

    const [advancedOpen, setAdvancedOpen] = useState(false);
    const reduceMotion = useReducedMotion();
    const duration = reduceMotion ? 0 : 0.2;

    return (
        <form
            id="extension-settings"
            className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-control max-[400px]:p-4"
            aria-busy={loading}
            onSubmit={(event) => {
                event.preventDefault();

                const data = new FormData(event.currentTarget);
                void saveSettings(data);
            }}
        >
            <div className="mb-5">
                <h2
                    className="text-lg leading-[1.4] focus:outline-none"
                    id="settings-title"
                    tabIndex={-1}
                >
                    Settings
                </h2>
                <p className="mt-1.5 text-[0.8125rem] leading-[1.6] text-fg-muted">
                    Choose how Mossy looks and works in your browser.
                </p>
            </div>
            <fieldset
                className="grid min-w-0 grid-cols-3 gap-2 border-0 p-0"
                disabled={loading}
                aria-busy={savingTheme}
            >
                <legend className="mb-2.5 block text-xs font-semibold text-fg-secondary">
                    Appearance
                </legend>
                {(
                    [
                        ['system', 'System', MdMonitor],
                        ['light', 'Light', MdLightMode],
                        ['dark', 'Dark', MdDarkMode],
                    ] as const
                ).map(([value, label, Icon]) => (
                    <label
                        key={value}
                        className="relative cursor-pointer text-xs font-semibold text-fg-secondary"
                    >
                        <input
                            className="peer absolute inset-0 z-1 size-full cursor-pointer opacity-0"
                            type="radio"
                            name="theme"
                            value={value}
                            checked={theme === value}
                            onChange={() => void saveTheme(value)}
                        />
                        <span className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface text-xs peer-checked:border-fg-brand peer-checked:bg-[color-mix(in_srgb,var(--color-fg-brand)_6%,var(--color-surface))] peer-checked:text-fg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg-brand peer-disabled:cursor-wait peer-disabled:opacity-55 max-[400px]:flex-col max-[400px]:px-1 max-[400px]:py-2">
                            <Icon size={19} aria-hidden="true" />
                            {label}
                        </span>
                    </label>
                ))}
            </fieldset>
            <p className="mt-2.5 mb-4 text-xs leading-[1.6] text-fg-muted">
                Follow your device or choose a light or dark theme. Changes save
                automatically.
            </p>
            <div className="mt-[22px] border-t border-border pt-5">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[0.9375rem] leading-[1.4]">
                        Website access
                    </h3>
                    {view.permission && (
                        <span className="inline-flex items-center gap-[5px] text-[0.6875rem] text-fg-success">
                            <MdCheckCircle size={15} aria-hidden="true" />
                            Enabled
                        </span>
                    )}
                </div>
                <p className="mt-2.5 mb-4 text-xs leading-[1.6] text-fg-muted">
                    Allow HTTP and HTTPS website access to suggest saved logins, fill
                    forms, and offer to save submitted passwords.
                </p>
                <Button
                    className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer"
                    type="button"
                    padding="medium"
                    variant="outline"
                    disabled={loading || view.permission}
                    onClick={() => void enableWebsiteAccess()}
                >
                    {view.permission
                        ? 'Website access enabled'
                        : 'Enable fill and capture'}
                </Button>
            </div>
            <section className="mt-[22px] border-t border-border pt-3.5">
                <button
                    type="button"
                    className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-md py-2 text-left text-[0.8125rem] font-semibold text-fg-secondary"
                    aria-expanded={advancedOpen}
                    aria-controls="advanced-settings-content"
                    onClick={() => setAdvancedOpen((open) => !open)}
                >
                    Advanced settings
                    <motion.div
                        initial={false}
                        animate={{
                            rotateZ: advancedOpen ? 180 : 0,
                        }}
                        transition={{
                            type: 'spring',
                            duration,
                            bounce: 0.35,
                        }}
                    >
                        <MdExpandMore
                            className="shrink-0 text-fg-muted"
                            size={20}
                            aria-hidden="true"
                        />
                    </motion.div>
                </button>

                <motion.div
                    id="advanced-settings-content"
                    className="overflow-hidden"
                    inert={!advancedOpen}
                    initial={false}
                    animate={{
                        height: advancedOpen ? 'auto' : 0,
                        opacity: advancedOpen ? 1 : 0,
                        visibility: advancedOpen ? 'visible' : 'hidden',
                    }}
                    transition={{
                        duration,
                        visibility: { delay: advancedOpen ? 0 : duration },
                    }}
                >
                    <div
                        className="mt-3 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--color-fg-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-fg-warning)_5%,var(--color-surface))] p-3.5"
                        id="instance-warning"
                    >
                        <MdWarningAmber
                            className="mt-0.5 shrink-0 text-fg-warning"
                            size={20}
                            aria-hidden="true"
                        />
                        <div>
                            <h3 className="font-sans text-[0.8125rem] leading-normal font-semibold">
                                Only change this if you know what you’re doing
                            </h3>
                            <p className="mt-2 text-xs leading-[1.6] text-fg-secondary">
                                Your sign-in credentials will be sent to this
                                server. Only use a Mossy instance you trust.
                                Changing it signs you out.
                            </p>
                        </div>
                    </div>
                    <label
                        className="mt-4 mb-[7px] block text-xs font-semibold text-fg-secondary"
                        htmlFor="instance"
                    >
                        Mossy instance
                    </label>
                    <input
                        className="block min-h-11 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm leading-normal text-fg-primary placeholder:text-fg-subtle placeholder:opacity-100 focus-visible:border-fg-brand focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        id="instance"
                        name="instance"
                        type="url"
                        required
                        defaultValue={view.instance}
                        disabled={loading}
                        aria-describedby="instance-warning"
                        onInvalid={() => {
                            // Reveal the field before native validation focuses it.
                            flushSync(() => setAdvancedOpen(true));
                        }}
                    />
                </motion.div>
            </section>

            <Button
                type="submit"
                padding="medium"
                disabled={loading || savingTheme}
                className="inline-flex items-center justify-center gap-[7px] whitespace-nowrap font-semibold [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-55 motion-safe:enabled:active:scale-[0.98] min-h-10 text-[0.8125rem] cursor-pointer mt-[22px] w-full"
            >
                Save settings
            </Button>
        </form>
    );
}
