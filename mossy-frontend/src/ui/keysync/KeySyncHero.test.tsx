import { useAuthStore } from '../../store/authStore.ts';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceStore } from '../../store/deviceStore.ts';
import { useEncryptionStore } from '../../store/encryptionStore.ts';
import { globalStyleTokens } from '../../theme/globalTokens.ts';
import KeySyncHero from './KeySyncHero.tsx';

const services = vi.hoisted(() => ({
    getVerifiedReceiver: vi.fn(),
    sendVaultKey: vi.fn(),
}));
const encryption = vi.hoisted(() => ({
    loadKey: vi.fn(),
    getKeyMetadata: vi.fn(),
}));

const passkeys = vi.hoisted(() => ({
    getPasskey: vi.fn(),
    supportsPasskeys: () => true,
}));
vi.mock('../../auth/passkeys.ts', () => passkeys);
vi.mock('../../key-sync/sendVaultKey.ts', () => services);
vi.mock('../../storage/vaultKeys.ts', () => ({
    keyStorage: encryption,
}));

describe('key sync sender page', () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });
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
        // jsdom does not implement the layout observer used by the OTP inputs.
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe = vi.fn();
                unobserve = vi.fn();
                disconnect = vi.fn();
            }
        );
        document.documentElement.style.setProperty(
            globalStyleTokens.brand,
            '#a7bd71'
        );
        document.documentElement.style.setProperty(
            globalStyleTokens.border,
            '#dddddd'
        );
        useDeviceStore.setState({
            deviceId: 'sender-device',
            idKey: { type: 'Ed25519', public: 'public', private: 'private' },
        });
        useEncryptionStore.setState({ passkeys: {} });
        services.getVerifiedReceiver.mockResolvedValue({
            receiverId: 'receiver-device',
            vaultId: 'vault-one',
        });
        services.sendVaultKey.mockResolvedValue(undefined);
        encryption.loadKey.mockResolvedValue({});
        encryption.getKeyMetadata.mockResolvedValue({
            type: 'PRF',
            credentialId: 'Y3JlZA',
            prfSalt: new Uint8Array(32),
        });
        passkeys.getPasskey.mockResolvedValue(new Uint8Array(32).fill(7));
    });

    it('accepts letters in manually entered codes and uploads once after normalizing case', async () => {
        useEncryptionStore
            .getState()
            .setPasskey('vault-one', new TextEncoder().encode('1234'));
        render(
            <MemoryRouter>
                <KeySyncHero />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByRole('textbox', { name: 'Sync code' }), {
            target: { value: 'abc123' },
        });

        await screen.findByRole('heading', {
            name: 'Key transferred successfully',
        });

        expect(services.getVerifiedReceiver).toHaveBeenCalledWith(
            'ABC123',
            'sender-device',
            expect.any(AbortSignal)
        );
        expect(services.sendVaultKey).toHaveBeenCalledOnce();
        expect(encryption.loadKey).toHaveBeenCalledWith(
            'vault-one',
            new TextEncoder().encode('1234')
        );
    });

    it('handles a linked alphanumeric code in StrictMode and allows retrying a failed passkey unlock', async () => {
        encryption.loadKey
            .mockRejectedValueOnce(new Error('Invalid passkey'))
            .mockResolvedValue({});
        render(
            <StrictMode>
                <MemoryRouter initialEntries={['/key-sync?code=ABC123']}>
                    <KeySyncHero />
                </MemoryRouter>
            </StrictMode>
        );
        await screen.findByRole('alert');

        expect(services.getVerifiedReceiver).toHaveBeenCalledOnce();

        expect(screen.getByRole('alert').textContent).toContain(
            'Invalid passkey'
        );
        expect(services.sendVaultKey).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        await waitFor(() =>
            expect(services.sendVaultKey).toHaveBeenCalledOnce()
        );

        await screen.findByRole('heading', {
            name: 'Key transferred successfully',
        });
    });
});
