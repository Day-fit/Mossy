import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import KeySyncStep from './KeySyncStep.tsx';
import type { VaultKeyProtection } from '../../../types/vaultKey.ts';

const protection: VaultKeyProtection = {
    userId: 'user-one',
    passkey: new TextEncoder().encode('a vault password'),
    metadata: { type: 'Text' },
};

const { qrConfig } = vi.hoisted(() => ({
    qrConfig: vi.fn(),
}));

vi.mock('../../../hooks/useKeySyncReceiver.ts', () => ({
    useKeySyncReceiver: () => ({ phase: 'waiting', code: 'ABC123' }),
}));

vi.mock('qr-code-styling', () => ({
    default: class {
        constructor(config: unknown) {
            qrConfig(config);
        }
        append() {}
    },
}));

afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
});

it('keeps the QR colors and instance stable when the theme changes', async () => {
    document.documentElement.style.setProperty('--color-brand', '#007735');
    document.documentElement.style.setProperty('--color-qr-surface', '#ffffff');
    document.documentElement.style.setProperty('--color-surface', '#21251e');
    document.documentElement.dataset.theme = 'dark';
    const close = vi.fn();
    const { rerender } = render(
        <KeySyncStep
            vaultId="vault-1"
            protection={protection}
            setIsKeySyncModalActive={close}
        />
    );

    await waitFor(() => expect(qrConfig).toHaveBeenCalledTimes(1));
    expect(qrConfig.mock.calls[0][0]).toMatchObject({
        data: expect.stringContaining('/key-sync?code=ABC123'),
        backgroundOptions: { color: '#ffffff' },
        dotsOptions: { color: '#007735' },
        cornersSquareOptions: { color: '#007735' },
        cornersDotOptions: { color: '#007735' },
    });

    document.documentElement.dataset.theme = 'light';
    rerender(
        <KeySyncStep
            vaultId="vault-1"
            protection={protection}
            setIsKeySyncModalActive={close}
        />
    );

    expect(qrConfig).toHaveBeenCalledTimes(1);
});
