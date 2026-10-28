import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccountMenu from './AccountMenu.tsx';
import Layout from '../../routes/Layout.tsx';
import Settings from '../../routes/Settings.tsx';
import { useAuthStore } from '../../store/authStore.ts';
import { tokenStorage } from 'mossy-api-client/tokenStorage';
import { THEME_STORAGE_KEY, useThemeStore } from '../../store/themeStore.ts';
import { installBrowserStorage } from '../../test/browserStorage.ts';

const { executeLogoutRequest } = vi.hoisted(() => ({
    executeLogoutRequest: vi.fn(),
}));
vi.mock('mossy-api-client/auth.api', () => ({
    executeLogoutRequest,
    executeUserDetailsRequest: vi.fn(),
}));

beforeEach(() => {
    installBrowserStorage();
    vi.resetAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({ isAuthenticated: false, userDetails: null });
    useThemeStore.setState({ preference: 'system', persistenceError: false });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function renderMenu() {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
        <MemoryRouter>
            <AccountMenu
                username="Mossy user"
                signingOut={false}
                onSignOut={onSignOut}
            />
            <button>Outside</button>
        </MemoryRouter>
    );
    return {
        trigger: screen.getByRole('button', { name: 'Account menu' }),
        onSignOut,
    };
}

describe('account menu', () => {
    it('focuses its first item and supports wrapping, Home, End, and Escape', () => {
        const { trigger } = renderMenu();
        fireEvent.click(trigger);
        const settings = screen.getByRole('menuitem', { name: 'Settings' });
        const signOut = screen.getByRole('menuitem', { name: 'Sign out' });
        expect(document.activeElement).toBe(settings);
        fireEvent.keyDown(settings, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(signOut);
        fireEvent.keyDown(signOut, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(settings);
        fireEvent.keyDown(settings, { key: 'End' });
        expect(document.activeElement).toBe(signOut);
        fireEvent.keyDown(signOut, { key: 'Home' });
        expect(document.activeElement).toBe(settings);
        fireEvent.keyDown(settings, { key: 'Escape' });
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(trigger);
    });

    it('opens at the last item with ArrowUp and dismisses on outside interaction', async () => {
        const { trigger } = renderMenu();
        fireEvent.keyDown(trigger, { key: 'ArrowUp' });
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Sign out' })
        );
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        act(() => screen.getByRole('button', { name: 'Outside' }).focus());
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('shows the username and invokes sign out', () => {
        const { trigger, onSignOut } = renderMenu();
        fireEvent.click(trigger);
        expect(screen.getByText('Mossy user')).toBeTruthy();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
        expect(onSignOut).toHaveBeenCalledTimes(1);
    });
});

function renderLayout() {
    render(
        <MemoryRouter initialEntries={['/settings']}>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<h1>Home fixture</h1>} />
                    <Route path="/settings" element={<Settings />} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

it('makes Settings available to guests in the header, footer, and mobile navigation', () => {
    renderLayout();
    expect(
        within(screen.getByRole('navigation')).getByRole('link', {
            name: 'Settings',
        })
    ).toBeTruthy();
    expect(
        within(screen.getByRole('contentinfo')).getByRole('link', {
            name: 'Settings',
        })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const mobile = document.getElementById('mobile-navigation')!;
    expect(within(mobile).getByRole('link', { name: 'Settings' })).toBeTruthy();
});

it.each([
    { fails: false, mobile: false },
    { fails: true, mobile: false },
    { fails: false, mobile: true },
    { fails: true, mobile: true },
])(
    'clears auth and returns home while keeping the theme (fails=$fails, mobile=$mobile)',
    async ({ fails, mobile }) => {
        if (fails) executeLogoutRequest.mockRejectedValue(new Error('Offline'));
        else executeLogoutRequest.mockResolvedValue(undefined);
        useAuthStore.setState({
            isAuthenticated: true,
            userDetails: {
                userId: '1',
                username: 'Mossy user',
                email: null,
                grantedAuthorities: [],
            },
        });
        tokenStorage.set('test-token');
        useThemeStore.getState().setPreference('dark');
        renderLayout();
        if (mobile) {
            fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
            const menu = document.getElementById('mobile-navigation')!;
            expect(within(menu).getByText('Mossy user')).toBeTruthy();
            expect(
                within(menu)
                    .getByRole('link', { name: 'Settings' })
                    .getAttribute('aria-current')
            ).toBe('page');
            fireEvent.click(
                within(menu).getByRole('button', { name: 'Sign out' })
            );
        } else {
            fireEvent.click(
                screen.getByRole('button', { name: 'Account menu' })
            );
            fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
        }
        await screen.findByRole('heading', { name: 'Home fixture' });
        expect(executeLogoutRequest).toHaveBeenCalledTimes(1);
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        expect(tokenStorage.get()).toBeNull();
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    }
);
