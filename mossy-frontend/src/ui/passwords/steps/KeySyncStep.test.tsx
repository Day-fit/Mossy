import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { SetStateAction } from 'react';
import KeySyncStep from './KeySyncStep.tsx';

type QrConfig = {
    data: string;
    backgroundOptions?: { color?: string };
    dotsOptions?: { color?: string };
    cornersSquareOptions?: { color?: string };
    cornersDotOptions?: { color?: string };
};

const { qrConfig } = vi.hoisted(() => ({
    qrConfig: vi.fn<(config: QrConfig) => void>(),
}));

vi.mock('../../../hooks/useKeySyncReceiver.ts', () => ({
    useKeySyncReceiver: () => ({ phase: 'waiting', code: 'ABC123' }),
}));
vi.mock('../../shared/VaultAccessModal.tsx', () => ({ default: () => null }));
vi.mock('qr-code-styling', () => ({
    default: class {
        constructor(config: QrConfig) {
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
    const close = vi.fn<(value: SetStateAction<boolean>) => void>();
    const { rerender } = render(
        <KeySyncStep
            vaultId="vault-1"
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
            setIsKeySyncModalActive={close}
        />
    );
    expect(qrConfig).toHaveBeenCalledTimes(1);
});
