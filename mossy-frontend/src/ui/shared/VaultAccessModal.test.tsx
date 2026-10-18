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
const supportsPasskeys = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useVaultAccess.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useVaultAccess.ts')>()),
    useVaultAccess: () => access,
    supportsPasskeys,
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
    supportsPasskeys.mockReturnValue(true);
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
    access.getKeyMetadata.mockResolvedValue({ type: 'Text' });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function enterSetupPassword() {
    fireEvent.change(screen.getByLabelText('Vault password'), {
        target: { value: 'a vault password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm vault password'), {
        target: { value: 'a vault password' },
    });
}

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
        access.getKeyMetadata.mockResolvedValue({
            type: 'PRF',
            credentialId: 'saved',
            prfSalt: new Uint8Array(32),
        });
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
        access.getKeyMetadata.mockResolvedValue({
            type: 'PRF',
            credentialId: 'saved',
            prfSalt: new Uint8Array(32),
        });
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

    it('retries a failed key lookup and opens the saved password form directly', async () => {
        access.getKeyMetadata.mockRejectedValueOnce(
            new Error('Could not open local storage')
        );
        render(
            <VaultAccessModal mode="unlock" vaultId="vault" onClose={vi.fn()} />
        );

        await screen.findByRole('alert');
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        const password = await screen.findByLabelText('Vault password');

        expect(document.activeElement).toBe(password);
        expect(access.getKeyMetadata).toHaveBeenCalledTimes(2);
        expect(access.unlockVault).not.toHaveBeenCalled();
    });

    it('ignores automatic unlock completion after the dialog is dismissed', async () => {
        access.getKeyMetadata.mockResolvedValue({
            type: 'PRF',
            credentialId: 'saved',
            prfSalt: new Uint8Array(32),
        });
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

    it('falls back to a confirmed text password when PRF is unavailable', async () => {
        access.registerVaultKey.mockRejectedValueOnce(
            new PrfNotSupportedError()
        );
        const onClose = vi.fn();
        render(
            <VaultAccessModal
                mode="register"
                vaultId="vault"
                onClose={onClose}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Use passkey' }));

        await screen.findByLabelText('Confirm vault password');

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('status').textContent).toContain('unavailable');

        enterSetupPassword();
        fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(access.registerVaultKey).toHaveBeenLastCalledWith(
            'vault',
            { type: 'Text', password: 'a vault password' },
            expect.any(AbortSignal)
        );
    });

    it('shows password setup immediately without WebAuthn and validates confirmation', async () => {
        supportsPasskeys.mockReturnValue(false);
        render(
            <VaultAccessModal
                mode="register"
                vaultId="vault"
                onClose={vi.fn()}
            />
        );

        enterSetupPassword();
        fireEvent.change(screen.getByLabelText('Confirm vault password'), {
            target: { value: 'different' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

        expect(screen.getByRole('alert').textContent).toContain('do not match');
        expect(access.registerVaultKey).not.toHaveBeenCalled();
    });

    it('keeps failed unlock attempts open and notifies the caller only after success', async () => {
        access.unlockVault.mockRejectedValueOnce(new Error('Invalid passkey'));
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
        const password = await screen.findByLabelText('Vault password');

        expect(document.activeElement).toBe(password);
        expect(access.unlockVault).not.toHaveBeenCalled();

        fireEvent.change(password, { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));

        await screen.findByRole('alert');

        expect(onClose).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();

        fireEvent.change(password, { target: { value: 'correct' } });
        fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not offer password fallback when unlocking an existing PRF key fails', async () => {
        access.getKeyMetadata.mockResolvedValue({
            type: 'PRF',
            credentialId: 'credential',
            prfSalt: new Uint8Array(32),
        });
        access.unlockVault.mockRejectedValue(new PrfNotSupportedError());
        render(
            <VaultAccessModal mode="unlock" vaultId="vault" onClose={vi.fn()} />
        );

        await screen.findByRole('alert');

        expect(access.unlockVault).toHaveBeenCalledOnce();

        expect(screen.queryByLabelText('Vault password')).toBeNull();
        expect(access.registerVaultKey).not.toHaveBeenCalled();
    });

    it('prepares key-sync protection without registering a replacement vault key', async () => {
        supportsPasskeys.mockReturnValue(false);
        const protection = {
            passkey: new Uint8Array(32),
            metadata: { type: 'Text' },
        };
        access.prepareProtection.mockResolvedValue(protection);
        const onPrepared = vi.fn();
        const onClose = vi.fn();
        render(
            <VaultAccessModal
                mode="prepare"
                vaultId="vault"
                onClose={onClose}
                onPrepared={onPrepared}
            />
        );

        enterSetupPassword();
        fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

        await waitFor(() =>
            expect(onPrepared).toHaveBeenCalledWith(protection)
        );
        expect(access.prepareProtection).toHaveBeenCalledWith(
            'vault',
            { type: 'Text', password: 'a vault password' },
            expect.any(AbortSignal)
        );
        expect(access.registerVaultKey).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
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
});
