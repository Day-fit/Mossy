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
const encryption = vi.hoisted(() => ({ loadKey: vi.fn(), setPin: vi.fn() }));
vi.mock('../../key-sync/sendVaultKey.ts', () => services);
vi.mock('../../hooks/useEncryptionHook.ts', () => ({
    useEncryptionHook: () => encryption,
}));

describe('key sync sender page', () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });
    beforeEach(() => {
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
        useEncryptionStore.setState({ pins: {} });
        services.getVerifiedReceiver.mockResolvedValue({
            receiverId: 'receiver-device',
            vaultId: 'vault-one',
        });
        services.sendVaultKey.mockResolvedValue(undefined);
        encryption.loadKey.mockResolvedValue({});
        encryption.setPin.mockImplementation((vaultId: string, pin: string) =>
            useEncryptionStore.getState().setPin(vaultId, pin)
        );
    });

    it('accepts letters in manually entered codes and uploads once after normalizing case', async () => {
        useEncryptionStore.getState().setPin('vault-one', '1234');
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
        expect(encryption.loadKey).toHaveBeenCalledWith('vault-one', '1234');
    });

    it('handles a linked alphanumeric code in StrictMode and allows retrying a wrong PIN', async () => {
        encryption.loadKey
            .mockRejectedValueOnce(new Error('Invalid pin'))
            .mockResolvedValue({});
        render(
            <StrictMode>
                <MemoryRouter initialEntries={['/key-sync?code=ABC123']}>
                    <KeySyncHero />
                </MemoryRouter>
            </StrictMode>
        );
        const pin = await screen.findByRole('textbox', { name: 'Vault PIN' });
        expect(services.getVerifiedReceiver).toHaveBeenCalledOnce();

        fireEvent.change(pin, { target: { value: '1111' } });
        await screen.findByRole('alert');
        expect(screen.getByRole('alert').textContent).toContain('Invalid pin');
        expect(services.sendVaultKey).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox', { name: 'Vault PIN' }), {
            target: { value: '1234' },
        });
        await waitFor(() =>
            expect(services.sendVaultKey).toHaveBeenCalledOnce()
        );
        await screen.findByRole('heading', {
            name: 'Key transferred successfully',
        });
    });
});
