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
import type { ReceiverDetails } from '../../api/keySync.api.ts';
import type { CryptoPair } from '../../auth/deviceIdentity.ts';
import { useAuthStore } from '../../store/authStore.ts';
import { useDeviceStore } from '../../store/deviceStore.ts';
import { globalStyleTokens } from '../../theme/globalTokens.ts';
import KeySyncHero from './KeySyncHero.tsx';

const services = vi.hoisted(() => ({
    getVerifiedReceiver: vi.fn<(
        code: string,
        senderId: string,
        signal: AbortSignal
    ) => Promise<ReceiverDetails>>(),
    sendVaultKey: vi.fn<(
        code: string,
        receiver: ReceiverDetails,
        senderId: string,
        identity: CryptoPair,
        key: CryptoKey,
        signal: AbortSignal
    ) => Promise<void>>(),
}));
const encryption = vi.hoisted(() => ({
    isVaultUnlocked: vi.fn<(vaultId: string) => Promise<boolean>>(),
    getUnlockedKey: vi.fn<(vaultId: string) => CryptoKey | undefined>(),
}));
vi.mock('../../key-sync/sendVaultKey.ts', () => services);
vi.mock('../../hooks/useEncryptionHook.ts', () => ({
    useEncryptionHook: () => encryption,
}));
vi.mock('../shared/VaultAccessModal.tsx', () => ({
    default: ({ onSuccess }: { onSuccess?: () => void }) => (
        <button type="button" onClick={onSuccess}>Unlock test vault</button>
    ),
}));

describe('key sync sender page', () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe = vi.fn<() => void>();
                unobserve = vi.fn<() => void>();
                disconnect = vi.fn<() => void>();
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
        useAuthStore.setState({
            isAuthenticated: true,
            userDetails: {
                userId: 'user-one',
                email: 'one@example.test',
                username: 'One',
                grantedAuthorities: [],
            },
        });
        useDeviceStore.setState({
            deviceId: 'sender-device',
            idKey: { type: 'Ed25519', public: 'public', private: 'private' },
        });
        services.getVerifiedReceiver.mockResolvedValue({
            receiverId: 'receiver-device',
            vaultId: 'vault-one',
            publicDh: { kty: 'OKP', crv: 'X25519', x: 'public' },
            signature: 'signature',
        });
        services.sendVaultKey.mockResolvedValue(undefined);
        encryption.isVaultUnlocked.mockResolvedValue(true);
        encryption.getUnlockedKey.mockReturnValue({
            algorithm: { name: 'AES-GCM' },
            extractable: true,
            type: 'secret',
            usages: ['encrypt', 'decrypt'],
        });
    });

    it('normalizes a manually entered code and sends the unlocked key once', async () => {
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
    });

    it('prompts to unlock a linked vault and resumes the transfer', async () => {
        encryption.isVaultUnlocked
            .mockResolvedValueOnce(false)
            .mockResolvedValue(true);
        render(
            <StrictMode>
                <MemoryRouter initialEntries={['/key-sync?code=ABC123']}>
                    <KeySyncHero />
                </MemoryRouter>
            </StrictMode>
        );
        const unlock = await screen.findByRole('button', {
            name: 'Unlock test vault',
        });
        expect(services.sendVaultKey).not.toHaveBeenCalled();
        fireEvent.click(unlock);
        await waitFor(() =>
            expect(services.sendVaultKey).toHaveBeenCalledOnce()
        );
        await screen.findByRole('heading', {
            name: 'Key transferred successfully',
        });
    });
});
