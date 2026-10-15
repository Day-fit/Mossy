import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import KeySyncStep from './KeySyncStep.tsx';

const { initializeKeySync, connect, disconnect, qrConfig } = vi.hoisted(() => ({
    initializeKeySync: vi.fn().mockResolvedValue('123456'),
    connect: vi.fn(() => new Promise<void>(() => {})),
    disconnect: vi.fn(),
    qrConfig: vi.fn(),
}));

vi.mock('../../../hooks/useDeviceSync.ts', () => ({
    useDeviceSync: () => ({ initializeKeySync, connect, disconnect }),
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

it('uses constant green QR modules on a white canvas and does not restart sync when the theme changes', async () => {
    document.documentElement.style.setProperty('--color-brand', '#007735');
    document.documentElement.style.setProperty('--color-qr-surface', '#ffffff');
    document.documentElement.style.setProperty('--color-surface', '#21251e');
    document.documentElement.dataset.theme = 'dark';
    const close = vi.fn();
    const { rerender } = render(
        <KeySyncStep
            vaultId="vault-1"
            pin="1234"
            setIsKeySyncModalActive={close}
        />
    );
    await waitFor(() => expect(qrConfig).toHaveBeenCalledTimes(1));
    expect(qrConfig.mock.calls[0][0]).toMatchObject({
        data: expect.stringContaining('/key-sync?code=123456'),
        backgroundOptions: { color: '#ffffff' },
        dotsOptions: { color: '#007735' },
        cornersSquareOptions: { color: '#007735' },
        cornersDotOptions: { color: '#007735' },
    });
    document.documentElement.dataset.theme = 'light';
    rerender(
        <KeySyncStep
            vaultId="vault-1"
            pin="1234"
            setIsKeySyncModalActive={close}
        />
    );
    expect(qrConfig).toHaveBeenCalledTimes(1);
    expect(initializeKeySync).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
});
