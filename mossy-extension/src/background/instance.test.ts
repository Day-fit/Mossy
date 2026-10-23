import { beforeEach, expect, it, vi } from 'vitest';

const setting = vi.hoisted(() => ({
    getValue: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn(),
}));

vi.mock('../storage/settings', () => ({ instanceSetting: setting }));

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    setting.getValue.mockResolvedValue('https://first.test');
    setting.setValue.mockResolvedValue(undefined);
});

it('shares the initial storage read across concurrent and later calls', async () => {
    const { getInstance } = await import('./instance');
    const first = getInstance();
    expect(getInstance()).toBe(first);
    expect(await first).toBe('https://first.test');
    expect(await getInstance()).toBe('https://first.test');
    expect(setting.getValue).toHaveBeenCalledTimes(1);
});

it('persists a new instance and updates the cached value', async () => {
    const { getInstance, setInstance } = await import('./instance');
    await getInstance();
    await setInstance('https://next.test');
    expect(setting.setValue).toHaveBeenCalledWith('https://next.test');
    expect(await getInstance()).toBe('https://next.test');
    expect(setting.getValue).toHaveBeenCalledTimes(1);
});

it('picks up changes written from another extension context', async () => {
    const { getInstance } = await import('./instance');
    await getInstance();
    setting.watch.mock.calls[0]![0]('https://external.test');
    expect(await getInstance()).toBe('https://external.test');
});
