import { afterEach, describe, expect, it, vi } from 'vitest';
import { expose } from 'comlink';

const peers: MessagePort[] = [];
const workers: MockWorker[] = [];

class MockWorker {
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    port: MessagePort;
    terminate = vi.fn(() => this.port.close());

    constructor() {
        const channel = new MessageChannel();
        this.port = channel.port1;
        peers.push(channel.port2);
        workers.push(this);
        expose(
            {
                read: async ({ ciphertext }: { ciphertext: string }) => {
                    if (ciphertext === 'pending')
                        return new Promise<string>(() => {});
                    if (ciphertext === 'invalid')
                        throw new Error('Invalid ciphertext.');
                    return `decrypted:${ciphertext}`;
                },
            },
            channel.port2
        );
    }

    postMessage(message: unknown, transfer: Transferable[]) {
        this.port.postMessage(message, transfer);
    }
    addEventListener(type: string, listener: EventListenerObject) {
        this.port.addEventListener(type, listener);
        this.port.start();
    }
    removeEventListener(type: string, listener: EventListenerObject) {
        this.port.removeEventListener(type, listener);
    }
}

vi.mock('./action.worker.ts?worker', () => ({ default: MockWorker }));
const { ActionWorker } = await import('./ActionWorker');

afterEach(() => {
    for (const worker of workers.splice(0)) worker.port.close();
    for (const port of peers.splice(0)) port.close();
});

describe('Comlink action worker lifecycle', () => {
    it('routes named calls and propagates remote errors', async () => {
        const worker = new ActionWorker();
        await expect(worker.read({ ciphertext: 'fixture' })).resolves.toBe(
            'decrypted:fixture'
        );
        await expect(worker.read({ ciphertext: 'invalid' })).rejects.toThrow(
            'Invalid ciphertext.'
        );
        worker.stop();
    });

    it('rejects every pending call and prevents calls after termination', async () => {
        const worker = new ActionWorker();
        const first = expect(
            worker.read({ ciphertext: 'pending' })
        ).rejects.toThrow('Action canceled.');
        const second = expect(
            worker.read({ ciphertext: 'pending' })
        ).rejects.toThrow('Action canceled.');
        worker.stop();
        worker.stop();
        await Promise.all([first, second]);
        await expect(worker.read({ ciphertext: 'fixture' })).rejects.toThrow(
            'Action closed.'
        );
        expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
    });

    it.each(['onerror', 'onmessageerror'] as const)(
        'cancels pending work on %s',
        async (event) => {
            const worker = new ActionWorker();
            const pending = expect(
                worker.read({ ciphertext: 'pending' })
            ).rejects.toThrow('Action canceled.');
            workers[0]![event]?.();
            await pending;
            expect(workers[0]!.terminate).toHaveBeenCalledOnce();
        }
    );
});
