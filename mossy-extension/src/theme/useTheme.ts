import { useCallback, useEffect, useState } from 'react';
import { themeSetting } from '../storage/settings';

import type { Theme } from './types';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('system');
    const apply = useCallback((value: Theme) => {
        document.documentElement.dataset.theme = value;
        setTheme(value);
    }, []);

    useEffect(() => {
        let active = true;
        let changed = false;

        const unwatch = themeSetting.watch((value) => {
            changed = true;
            apply(value);
        });

        void themeSetting.getValue().then((value) => {
            const shouldApplyStoredTheme = active && !changed;
            if (shouldApplyStoredTheme) {
                apply(value);
            }
        });

        return () => {
            active = false;
            unwatch();
        };
    }, [apply]);

    return { theme, apply };
}
