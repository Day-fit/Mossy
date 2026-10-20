import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const normalizeTheme = (value: unknown): Theme =>
    value === 'light' || value === 'dark' ? value : 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('system');

    useEffect(() => {
        let active = true;
        let changed = false;

        const apply = (value: unknown) => {
            const next = normalizeTheme(value);
            document.documentElement.dataset.theme = next;
            setTheme(next);
        };

        const listener = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string
        ) => {
            if (area !== 'local' || !changes.theme) {
                return;
            }

            changed = true;
            apply(changes.theme.newValue);
        };

        chrome.storage.onChanged.addListener(listener);
        void chrome.storage.local.get('theme').then((settings) => {
            if (active && !changed) {
                apply(settings.theme);
            }
        });

        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    return theme;
}
