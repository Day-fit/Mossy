import { useEffect, useState } from 'react';
import { themeSetting } from './settings';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('system');

    useEffect(() => {
        let active = true;
        let changed = false;

        const apply = (value: Theme) => {
            document.documentElement.dataset.theme = value;
            setTheme(value);
        };

        const unwatch = themeSetting.watch((value) => {
            changed = true;
            apply(value);
        });

        void themeSetting.getValue().then((value) => {
            if (active && !changed) {
                apply(value);
            }
        });

        return () => {
            active = false;
            unwatch();
        };
    }, []);

    return theme;
}
