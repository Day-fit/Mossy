import { useAuthStore } from '../../store/authStore.ts';
import { StrictMode } from 'react';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrfNotSupportedError } from '../../hooks/useVaultAccess.ts';
import VaultAccessModal from './VaultAccessModal.tsx';

const access = vi.hoisted(() => ({
    registerVaultKey: vi.fn(),
    unlockVault: vi.fn(),
    prepareProtection: vi.fn(),
    getKeyMetadata: vi.fn(),
}));
vi.mock('../../hooks/useVaultAccess.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useVaultAccess.ts')>()),
    useVaultAccess: () => access,
}));

beforeEach(() => {
    useAuthStore.setState({
        isAuthenticated: true,
        userDetails: {
            userId: 'user-one',
            email: 'one@example.test',
            username: 'One',
            grantedAuthorities: [],
        },
    });

    vi.resetAllMocks();
    vi.stubGlobal('PublicKeyCredential', class {});
    Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: { create: vi.fn(), get: vi.fn() },
    });
    access.getKeyMetadata.mockResolvedValue({
        type: 'PRF',
        credentialId: 'Y3JlZA',
        prfSalt: new Uint8Array(32),
    });
    vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
            matches: false,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('vault access modal', () => {
    it('starts PRF registration only on submission, including in StrictMode', async () => {
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        render(
            <StrictMode>
                <VaultAccessModal
                    mode="register"
                    vaultId="vault"
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </StrictMode>
        );

        expect(access.registerVaultKey).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Use passkey' }));

        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(access.registerVaultKey).toHaveBeenCalledExactlyOnceWith(
            'vault',
            { type: 'PRF' },
            expect.any(AbortSignal)
        );
        expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('automatically unlocks an existing passkey once in StrictMode without another confirmation', async () => {
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        const view = (
            <StrictMode>
                <VaultAccessModal
                    mode="unlock"
                    vaultId="vault"
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </StrictMode>
        );
        const { rerender } = render(view);

        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        rerender(view);

        expect(access.unlockVault).toHaveBeenCalledExactlyOnceWith(
            'vault',
            '',
            expect.any(AbortSignal)
        );
        expect(access.registerVaultKey).not.toHaveBeenCalled();
        expect(access.prepareProtection).not.toHaveBeenCalled();
        expect(
            screen.queryByRole('button', { name: 'Unlock with passkey' })
        ).toBeNull();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('offers an explicit retry after a cancelled automatic passkey request', async () => {
        access.unlockVault.mockRejectedValueOnce(
            new DOMException('Passkey request cancelled', 'NotAllowedError')
        );
        const onSuccess = vi.fn();
        render(
            <VaultAccessModal
                mode="unlock"
                vaultId="vault"
                onClose={vi.fn()}
                onSuccess={onSuccess}
            />
        );

        await screen.findByRole('alert');

        expect(access.unlockVault).toHaveBeenCalledOnce();
        expect(onSuccess).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(access.unlockVault).toHaveBeenCalledTimes(2);
    });

    it('offers password setup with a notice only for unsupported PRF', async () => {
        access.registerVaultKey.mockRejectedValueOnce(
            new PrfNotSupportedError()
        );
        render(
            <VaultAccessModal
                mode="register"
                vaultId="vault"
                onClose={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Use passkey' }));
        expect(
            await screen.findByLabelText('Confirm vault password')
        ).toBeTruthy();
        expect(screen.getByRole('status').textContent).toContain(
            'Passkeys are unavailable'
        );
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('keeps other registration failures visible without switching methods', async () => {
        access.registerVaultKey.mockRejectedValueOnce(
            new Error('Storage unavailable')
        );
        render(
            <VaultAccessModal
                mode="register"
                vaultId="vault"
                onClose={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Use passkey' }));
        expect((await screen.findByRole('alert')).textContent).toContain(
            'Storage unavailable'
        );
        expect(screen.queryByLabelText('Vault password')).toBeNull();
    });

    it('retries a failed key lookup before choosing the unlock method', async () => {
        access.getKeyMetadata
            .mockRejectedValueOnce(new Error('Could not open local storage'))
            .mockResolvedValueOnce({ type: 'Text' });
        render(
            <VaultAccessModal mode="unlock" vaultId="vault" onClose={vi.fn()} />
        );

        expect((await screen.findByRole('alert')).textContent).toContain(
            'Could not open local storage'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByLabelText('Vault password')).toBeTruthy();
        expect(access.getKeyMetadata).toHaveBeenCalledTimes(2);
        expect(access.unlockVault).not.toHaveBeenCalled();
    });

    it('ignores automatic unlock completion after the dialog is dismissed', async () => {
        let finish!: () => void;
        access.unlockVault.mockReturnValue(
            new Promise<void>((resolve) => {
                finish = resolve;
            })
        );
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        render(
            <VaultAccessModal
                mode="unlock"
                vaultId="vault"
                onClose={onClose}
                onSuccess={onSuccess}
            />
        );

        await waitFor(() => expect(access.unlockVault).toHaveBeenCalledOnce());
        const signal = access.unlockVault.mock.calls[0][2] as AbortSignal;

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await act(async () => finish());

        expect(signal.aborted).toBe(true);
        expect(onClose).toHaveBeenCalledOnce();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('keeps keyboard focus inside the dialog and restores the previous focus on unmount', () => {
        const opener = document.createElement('button');
        document.body.append(opener);
        opener.focus();
        const onClose = vi.fn();
        const { unmount } = render(
            <VaultAccessModal
                mode="register"
                vaultId="vault"
                onClose={onClose}
            />
        );
        const lastButton = screen.getByRole('button', {
            name: 'Use passkey',
        });
        const firstButton = screen.getByRole('button', {
            name: 'Use a password instead',
        });

        lastButton.focus();
        fireEvent.keyDown(lastButton, { key: 'Tab' });
        expect(document.activeElement).toBe(firstButton);

        fireEvent.keyDown(firstButton, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(lastButton);

        fireEvent.keyDown(lastButton, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();

        unmount();
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('prevents duplicate requests and ignores completion after unmounting', async () => {
        let resolve!: () => void;
        access.registerVaultKey.mockReturnValue(
            new Promise<void>((done) => {
                resolve = done;
            })
        );
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        const { unmount } = render(
            <VaultAccessModal
                mode="register"
                vaultId="vault"
                onClose={onClose}
                onSuccess={onSuccess}
            />
        );

        fireEvent.submit(screen.getByRole('dialog'));
        fireEvent.submit(screen.getByRole('dialog'));

        expect(access.registerVaultKey).toHaveBeenCalledOnce();

        const signal = access.registerVaultKey.mock.calls[0][2] as AbortSignal;

        unmount();

        expect(signal.aborted).toBe(true);

        await act(async () => resolve());

        expect(onClose).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('offers password setup with confirmation and passes it to key sync preparation', async () => {
        const onPrepared = vi.fn();
        render(
            <VaultAccessModal
                mode="prepare"
                vaultId="vault"
                onClose={vi.fn()}
                onPrepared={onPrepared}
            />
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Use a password instead' })
        );
        fireEvent.change(screen.getByLabelText('Vault password'), {
            target: { value: 'a long vault password' },
        });
        fireEvent.change(screen.getByLabelText('Confirm vault password'), {
            target: { value: 'different password' },
        });
        fireEvent.submit(screen.getByRole('dialog'));
        expect(screen.getByRole('alert').textContent).toContain(
            'Passwords do not match'
        );
        expect(access.prepareProtection).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Confirm vault password'), {
            target: { value: 'a long vault password' },
        });
        fireEvent.submit(screen.getByRole('dialog'));
        await waitFor(() => expect(onPrepared).toHaveBeenCalledOnce());
        expect(access.prepareProtection).toHaveBeenCalledWith(
            'vault',
            { type: 'Text', password: 'a long vault password' },
            expect.any(AbortSignal)
        );
        expect(access.registerVaultKey).not.toHaveBeenCalled();
    });

    it('shows the password field for a stored password key without invoking a passkey', async () => {
        access.getKeyMetadata.mockResolvedValue({ type: 'Text' });
        const onSuccess = vi.fn();
        render(
            <VaultAccessModal
                mode="unlock"
                vaultId="vault"
                onClose={vi.fn()}
                onSuccess={onSuccess}
            />
        );
        const password = await screen.findByLabelText('Vault password');
        expect(access.unlockVault).not.toHaveBeenCalled();
        fireEvent.change(password, {
            target: { value: 'a long vault password' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(access.unlockVault).toHaveBeenCalledWith(
            'vault',
            'a long vault password',
            expect.any(AbortSignal)
        );
    });
});
