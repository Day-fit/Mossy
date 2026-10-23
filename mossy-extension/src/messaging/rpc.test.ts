import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it('disables transport logging because both directions carry secrets', async () => {
    const logs = ['debug', 'log', 'warn', 'error'].map((method) =>
        vi
            .spyOn(console, method as 'debug' | 'log' | 'warn' | 'error')
            .mockImplementation(() => {})
    );
    vi.stubGlobal('chrome', {
        runtime: {
            sendMessage: (_message: unknown, reply: (value: unknown) => void) =>
                reply({ res: 'secret-response' }),
        },
    });
    const { messaging } = await import('./rpc');
    expect(
        await messaging.sendMessage('handleLogin', {
            identifier: 'alice',
            password: 'account-secret',
        })
    ).toBe('secret-response');
    for (const log of logs) expect(log).not.toHaveBeenCalled();
});
