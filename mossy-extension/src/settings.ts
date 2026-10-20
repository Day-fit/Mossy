import { storage } from 'wxt/utils/storage';
import { DEFAULT_INSTANCE } from './security';
import type { Theme } from './theme';

export const instanceSetting = storage.defineItem<string>('local:instance', {
    fallback: DEFAULT_INSTANCE,
});

export const themeSetting = storage.defineItem<Theme>('local:theme', {
    fallback: 'system',
});

export const lastIdentifierSetting =
    storage.defineItem<string>('local:lastIdentifier');

export function saveSettings(instance: string, theme: Theme) {
    return storage.setItems([
        { item: instanceSetting, value: instance },
        { item: themeSetting, value: theme },
    ]);
}
