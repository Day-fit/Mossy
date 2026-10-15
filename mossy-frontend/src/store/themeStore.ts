import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'mossy.theme';

export function parseThemePreference(value: string | null): ThemePreference {
    return value === 'light' || value === 'dark' ? value : 'system';
}

function initialPreference(): ThemePreference {
    return typeof document === 'undefined'
        ? 'system'
        : parseThemePreference(
              document.documentElement.getAttribute('data-theme')
          );
}

type ThemeState = {
    preference: ThemePreference;
    persistenceError: boolean;
    setPreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
    preference: initialPreference(),
    persistenceError: false,
    setPreference: (preference) => {
        let persistenceError = false;
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, preference);
        } catch {
            persistenceError = true;
        }
        document.documentElement.dataset.theme = preference;
        set({ preference, persistenceError });
    },
}));

/** Sync browser preferences only. CSS owns system detection and palette selection. */
export function startThemePreferenceSync(): () => void {
    const preference = initialPreference();
    document.documentElement.dataset.theme = preference;
    useThemeStore.setState({ preference, persistenceError: false });

    const handleStorage = (event: StorageEvent) => {
        if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
        try {
            if (event.storageArea && event.storageArea !== window.localStorage)
                return;
        } catch {
            return;
        }
        const preference = parseThemePreference(
            event.key === null ? null : event.newValue
        );
        document.documentElement.dataset.theme = preference;
        useThemeStore.setState({ preference, persistenceError: false });
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
}
