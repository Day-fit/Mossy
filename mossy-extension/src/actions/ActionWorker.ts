import { wrap, releaseProxy, type Remote } from 'comlink';
import type {
    ActionWorkerApi,
    UnlockInput,
    OfferInput,
    SendInput,
    ReceiveInput,
    ProtectInput,
} from './worker/types';

/** Termination releases keys; pending callers also need to be rejected locally. */
export class ActionWorker implements ActionWorkerApi {
    // Keep the worker on the extension origin, including during WXT development.
    private worker = new Worker(chrome.runtime.getURL('/action-worker.js'));
    private remote: Remote<ActionWorkerApi> = wrap(this.worker);
    private pending = new Set<(error: Error) => void>();
    private stopped = false;

    constructor() {
        this.worker.onerror = () => this.stop();
        this.worker.onmessageerror = () => this.stop();
    }

    unlock = (input: UnlockInput) => this.run(() => this.remote.unlock(input));
    read = (input: { ciphertext: string }) =>
        this.run(() => this.remote.read(input));
    encrypt = (input: { password: string }) =>
        this.run(() => this.remote.encrypt(input));
    offer = (input: OfferInput) => this.run(() => this.remote.offer(input));
    send = (input: SendInput) => this.run(() => this.remote.send(input));
    receive = (input: ReceiveInput) =>
        this.run(() => this.remote.receive(input));
    protect = (input: ProtectInput) =>
        this.run(async () => this.remote.protect(input));

    private run<T>(operation: () => Promise<T>): Promise<T> {
        if (this.stopped) return Promise.reject(new Error('Action closed.'));
        return new Promise<T>((resolve, reject) => {
            this.pending.add(reject);
            Promise.resolve()
                .then(operation)
                .then(resolve, reject)
                .finally(() => this.pending.delete(reject));
        });
    }

    stop() {
        if (this.stopped) return;
        this.stopped = true;
        this.remote[releaseProxy]();
        this.worker.terminate();
        for (const reject of this.pending)
            reject(new Error('Action canceled.'));
        this.pending.clear();
    }
}
