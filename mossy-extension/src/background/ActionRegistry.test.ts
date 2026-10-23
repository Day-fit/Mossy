import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionRegistry } from './ActionRegistry';
import type { Action } from '../types/models';

const removed = vi.fn();
const create = vi.fn();
const remove = vi.fn();
let actions: ActionRegistry;
const action: Action = {
    id: 'action',
    operation: 'copy-password',
    scope: {
        instance: 'https://mossy.test',
        accountId: 'alice',
        vaultId: 'vault',
    },
    userId: 'alice',
    deviceId: 'device',
    deadline: 1000,
};
const sender = {
    documentId: 'document',
    url: 'chrome-extension://mossy/action.html#action',
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.resetAllMocks();
    create.mockResolvedValue({ id: 5 });
    remove.mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
        runtime: {
            getURL: (path: string) => `chrome-extension://mossy${path}`,
        },
        windows: { create, remove },
    });
    actions = new ActionRegistry(removed);
});

afterEach(() => {
    actions.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('action lifetime and ownership', () => {
    it('requires a claim before use and binds it to one document and URL', async () => {
        await actions.open(action);
        expect(() => actions.authorize(action.id, sender, false)).toThrow(
            'different document'
        );
        expect(actions.authorize(action.id, sender, true)).toEqual(action);
        expect(actions.authorize(action.id, sender, true)).toEqual(action);
        for (const other of [
            { ...sender, documentId: 'other' },
            { ...sender, url: sender.url + '-other' },
            { ...sender, documentId: undefined },
        ]) {
            expect(() => actions.authorize(action.id, other, true)).toThrow(
                'different document'
            );
        }
    });

    it('expires at the deadline and closes its window even without another request', async () => {
        await actions.open(action);
        await vi.advanceTimersByTimeAsync(999);
        expect(actions.get(action.id)).toEqual(action);
        await vi.advanceTimersByTimeAsync(1);
        expect(() => actions.get(action.id)).toThrow('expired');
        expect(removed).toHaveBeenCalledExactlyOnceWith(action);
        expect(remove).toHaveBeenCalledExactlyOnceWith(5);
    });

    it('consumes once and releases its timer while the result window remains open', async () => {
        await actions.open(action);
        expect(() => actions.consume(action.id, 'save')).toThrow('operation');
        expect(actions.consume(action.id, 'copy-password')).toEqual(action);
        expect(() => actions.consume(action.id, 'copy-password')).toThrow(
            'expired'
        );
        await vi.advanceTimersByTimeAsync(1000);
        expect(removed).toHaveBeenCalledTimes(1);
        expect(remove).not.toHaveBeenCalled();
    });

    it('releases state if opening the window fails', async () => {
        create.mockRejectedValueOnce(new Error('Window unavailable'));
        await expect(actions.open(action)).rejects.toThrow(
            'Window unavailable'
        );
        expect(() => actions.get(action.id)).toThrow('expired');
        expect(removed).toHaveBeenCalledExactlyOnceWith(action);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('closes a window that finishes opening after its action was canceled', async () => {
        let opened!: (window: { id: number }) => void;
        create.mockReturnValueOnce(
            new Promise((resolve) => {
                opened = resolve;
            })
        );
        const opening = actions.open(action);
        actions.clear();
        opened({ id: 6 });
        await opening;
        expect(remove).toHaveBeenCalledExactlyOnceWith(6);
        expect(vi.getTimerCount()).toBe(0);
    });
});
