import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
    featureRequestUrl,
    projectIssuesUrl,
} from '../helpers/projectLinks.ts';
import { THEME_STORAGE_KEY, useThemeStore } from '../store/themeStore.ts';
import Settings from './Settings.tsx';
import { installBrowserStorage } from '../test/browserStorage.ts';

beforeEach(() => {
    installBrowserStorage();
    window.localStorage.clear();
    useThemeStore.setState({ preference: 'system', persistenceError: false });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it('offers one native radio group and applies each appearance immediately', () => {
    render(<Settings />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeTruthy();
    expect(
        (screen.getByRole('radio', { name: 'System' }) as HTMLInputElement)
            .checked
    ).toBe(true);
    for (const [label, value] of [
        ['Dark', 'dark'],
        ['Light', 'light'],
        ['System', 'system'],
    ]) {
        fireEvent.click(screen.getByRole('radio', { name: label }));
        expect(document.documentElement.dataset.theme).toBe(value);
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(value);
        expect(
            screen
                .getAllByRole('radio')
                .filter((input) => (input as HTMLInputElement).checked)
        ).toHaveLength(1);
    }
});

it('explains when a preference can only be kept for this visit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
    });
    render(<Settings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('status').textContent).toContain(
        'Applied for this visit'
    );
    expect(
        (screen.getByRole('radio', { name: 'Dark' }) as HTMLInputElement)
            .checked
    ).toBe(true);
});

it('links to existing requests and the feature request form', () => {
    render(<Settings />);
    expect(
        screen.getByRole('link', { name: /Browse issues/ }).getAttribute('href')
    ).toBe(projectIssuesUrl);
    expect(
        screen
            .getByRole('link', { name: /Request a feature/ })
            .getAttribute('href')
    ).toBe(featureRequestUrl);
    expect(featureRequestUrl).toContain('template=feature_request.yml');
    expect(screen.getByText('More settings are coming.')).toBeTruthy();
});
