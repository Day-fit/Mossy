import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    useEncryptionHook: () => encryption,
}));

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('PublicKeyCredential', class {});
    encryption.getKeyMetadata.mockResolvedValue({ type: 'PRF' });
    encryption.prepareProtection.mockResolvedValue({
        type: 'PRF', userId: 'user', credentialId: new ArrayBuffer(4), wrappingKey: {},
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function renderPrepare(onPrepared = vi.fn()) {
    render(
        <VaultAccessModal
            mode="prepare"
            vaultId="vault-a"
            vaultName="Vault A"
            onClose={vi.fn()}
            onPrepared={onPrepared}
        />
    );
    return onPrepared;
}

it('passes the transferred credential ID to the existing-passkey choice', async () => {
    const credentialId = new Uint8Array([1, 2, 3]).buffer;
    const prepared = vi.fn();
    render(
        <VaultAccessModal
            mode="prepare"
            vaultId="vault-a"
            vaultName="Vault A"
            credentialId={credentialId}
            onClose={vi.fn()}
            onPrepared={prepared}
        />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Use existing passkey/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use existing passkey' }));
    await waitFor(() => expect(prepared).toHaveBeenCalledOnce());
    expect(encryption.prepareProtection).toHaveBeenCalledWith('vault-a', 'Vault A', {
        type: 'PRF', createNew: false, credentialId,
    });
    expect(encryption.registerVaultKey).not.toHaveBeenCalled();
});

it('shows the overwrite warning before registering a replacement passkey', async () => {
    const prepared = renderPrepare();
    fireEvent.click(screen.getByRole('button', { name: /^Register new passkey/ }));
    expect(screen.getByText('This may replace an existing passkey')).toBeTruthy();
    expect(encryption.prepareProtection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Register new passkey' }));
    await waitFor(() => expect(prepared).toHaveBeenCalledOnce());
    expect(encryption.prepareProtection).toHaveBeenCalledWith('vault-a', 'Vault A', {
        type: 'PRF', createNew: true,
    });
});

it('uses password protection when chosen', async () => {
    const prepared = renderPrepare();
    fireEvent.click(screen.getByRole('button', { name: /^Use password/ }));
    fireEvent.change(screen.getByLabelText('Vault password'), {
        target: { value: 'correct horse battery' },
    });
    fireEvent.change(screen.getByLabelText('Confirm vault password'), {
        target: { value: 'correct horse battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(prepared).toHaveBeenCalledOnce());
    expect(encryption.prepareProtection).toHaveBeenCalledWith('vault-a', 'Vault A', {
        type: 'Password', password: 'correct horse battery',
    });
});

it('keeps the choice available after a canceled passkey prompt', async () => {
    encryption.prepareProtection.mockRejectedValueOnce(
        new DOMException('Canceled', 'NotAllowedError')
    );
    renderPrepare();
    fireEvent.click(screen.getByRole('button', { name: /^Use existing passkey/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use existing passkey' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',
        'The passkey prompt was closed. Try again or choose another method.');
    fireEvent.click(screen.getByRole('button', { name: 'Choose another method' }));
    expect(screen.getByRole('button', { name: /^Register new passkey/ })).toBeTruthy();
    expect(encryption.prepareProtection).toHaveBeenCalledOnce();
});

it('uses the saved local method when unlocking and skips the choice screen', async () => {
    const close = vi.fn();
    render(<VaultAccessModal mode="unlock" vaultId="vault-a" onClose={close} />);
    await screen.findByRole('button', { name: 'Unlock vault' });
    expect(screen.queryByRole('button', { name: /^Register new passkey/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(encryption.unlockVault).toHaveBeenCalledWith('vault-a', '');
});

it('uses a saved password without asking for a method again', async () => {
    encryption.getKeyMetadata.mockResolvedValue({ type: 'Password' });
    const close = vi.fn();
    render(<VaultAccessModal mode="unlock" vaultId="vault-a" onClose={close} />);
    await screen.findByLabelText('Vault password');
    expect(screen.queryByRole('group', { name: 'Vault protection method' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Vault password'), {
        target: { value: 'correct horse battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(encryption.unlockVault).toHaveBeenCalledWith('vault-a', 'correct horse battery');
});

it('registers a new vault directly and keeps the dialog open while saving', async () => {
    let finish!: (value: object) => void;
    encryption.prepareProtection.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const close = vi.fn();
    render(<VaultAccessModal mode="register" vaultId="vault-a" vaultName="Vault A" onClose={close} />);
    expect(screen.queryByRole('button', { name: /^Use existing passkey/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Register new passkey' }));
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish({ type: 'PRF' }));
    expect(encryption.prepareProtection).toHaveBeenCalledWith('vault-a', 'Vault A', {
        type: 'PRF', createNew: true,
    });
    expect(close).toHaveBeenCalledOnce();
});
