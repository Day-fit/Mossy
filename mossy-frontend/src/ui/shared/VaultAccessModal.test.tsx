import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VaultAccessModal from './VaultAccessModal.tsx';

const encryption = vi.hoisted(() => ({
    getKeyMetadata: vi.fn(),
    prepareProtection: vi.fn(),
    registerVaultKey: vi.fn(),
    unlockVault: vi.fn(),
}));

vi.mock('../../hooks/useEncryptionHook.ts', () => ({
    VAULT_PASSWORD_MIN_LENGTH: 12,
    PrfNotSupportedError: class extends Error {},
    useEncryptionHook: () => encryption,
}));

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('PublicKeyCredential', class {});
    encryption.getKeyMetadata.mockResolvedValue({ type: 'PRF' });
    encryption.prepareProtection.mockRejectedValue(
        new DOMException('The operation was canceled.', 'NotAllowedError')
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

async function showRecovery() {
    fireEvent.click(screen.getByRole('button', { name: /^(Register key|Use passkey)$/ }));
    return screen.findByRole('dialog', { name: 'No passkey selected' });
}

it('offers retry and explicit creation after cancellation without saving a key', async () => {
    const close = vi.fn();
    render(
        <VaultAccessModal mode="register" vaultId="vault" onClose={close} />
    );
    await showRecovery();
    expect(encryption.prepareProtection).toHaveBeenCalledWith('vault', 'vault', {
        type: 'PRF', createNew: true,
    });
    expect(encryption.registerVaultKey).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Register key' }));
    await waitFor(() =>
        expect(encryption.prepareProtection).toHaveBeenCalledTimes(2)
    );
    expect(encryption.prepareProtection).toHaveBeenLastCalledWith('vault', 'vault', {
        type: 'PRF',
        createNew: true,
    });
    await waitFor(() =>
        expect(
            screen
                .getByRole('button', { name: 'Register key' })
                .hasAttribute('disabled')
        ).toBe(false)
    );

    const protection = { type: 'PRF', userId: 'user', wrappingKey: {} };
    encryption.prepareProtection.mockResolvedValue(protection);
    fireEvent.click(screen.getByRole('button', { name: 'Register key' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(encryption.prepareProtection).toHaveBeenLastCalledWith('vault', 'vault', {
        type: 'PRF',
        createNew: true,
    });
    expect(encryption.registerVaultKey).toHaveBeenCalledWith(
        'vault',
        protection
    );
});

it('lets the receiver prepare password protection from recovery without registering a key', async () => {
    const prepared = vi.fn();
    render(
        <VaultAccessModal
            mode="prepare"
            vaultId="vault"
            onClose={vi.fn()}
            onPrepared={prepared}
        />
    );
    await showRecovery();
    fireEvent.click(
        screen.getByRole('button', { name: 'Use a password instead' })
    );
    expect(
        screen.queryByRole('button', { name: 'Create new passkey' })
    ).toBeNull();
    fireEvent.change(screen.getByLabelText('Vault password'), {
        target: { value: 'correct horse battery' },
    });
    fireEvent.change(screen.getByLabelText('Confirm vault password'), {
        target: { value: 'correct horse battery' },
    });
    const protection = {
        type: 'Password',
        userId: 'user',
        wrappingKey: {},
        salt: new Uint8Array(16),
    };
    encryption.prepareProtection.mockResolvedValue(protection);
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(prepared).toHaveBeenCalledWith(protection));
    expect(encryption.prepareProtection).toHaveBeenLastCalledWith('vault', 'vault', {
        type: 'Password',
        password: 'correct horse battery',
    });
    expect(encryption.registerVaultKey).not.toHaveBeenCalled();
});

it('only retries the existing key when unlocking is canceled', async () => {
    encryption.unlockVault.mockRejectedValueOnce(
        new DOMException('Canceled', 'NotAllowedError')
    );
    const close = vi.fn();
    render(<VaultAccessModal mode="unlock" vaultId="vault" onClose={close} />);
    await waitFor(() =>
        expect(
            screen
                .getByRole('button', { name: 'Unlock vault' })
                .hasAttribute('disabled')
        ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));
    await screen.findByRole('dialog', { name: 'No passkey selected' });
    expect(
        screen.queryByRole('button', { name: 'Create new passkey' })
    ).toBeNull();
    expect(
        screen.queryByRole('button', { name: 'Use a password instead' })
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try passkey again' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(encryption.prepareProtection).not.toHaveBeenCalled();
});

it('keeps keyboard focus inside recovery and cancels without preparing another key', async () => {
    const close = vi.fn();
    render(
        <VaultAccessModal mode="register" vaultId="vault" onClose={close} />
    );
    const dialog = await showRecovery();
    expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'No passkey selected' })
    );
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Register key' })
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Use a password instead' })
    );
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    expect(encryption.prepareProtection).toHaveBeenCalledOnce();
});

it('keeps the dialog open while protection is being saved', async () => {
    let finish!: (value: object) => void;
    encryption.prepareProtection.mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const close = vi.fn();
    render(
        <VaultAccessModal mode="register" vaultId="vault" onClose={close} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Register key' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(dialog.parentElement!);
    expect(
        screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')
    ).toBe(true);
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish({ type: 'PRF' }));
    expect(close).toHaveBeenCalledOnce();
});

it('restores focus to the opener after the dialog closes', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
        <VaultAccessModal mode="register" vaultId="vault" onClose={vi.fn()} />
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
});
