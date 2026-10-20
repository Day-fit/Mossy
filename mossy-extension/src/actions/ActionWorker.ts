import SecretWorker from './action.worker.ts?worker';

/** Dedicated worker termination is the key-release boundary on every result and exit path. */
export class ActionWorker {
    private worker: Worker;
    private calls = new Map<
        string,
        { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    private stopped = false;

    constructor() {
        this.worker = new SecretWorker();
        this.worker.onmessage = ({ data }) => {
            const pending = this.calls.get(data.id);

            if (!pending) {
                return;
            }

            this.calls.delete(data.id);

            if (data.error) {
                pending.reject(new Error(data.error));

                return;
            }

            pending.resolve(data.result);
        };
        this.worker.onerror = () => this.stop();
    }

    call<T>(kind: string, input: Record<string, unknown> = {}): Promise<T> {
        if (this.stopped) {
            return Promise.reject(new Error('Action closed.'));
        }

        const id = crypto.randomUUID();

        return new Promise<T>((resolve, reject) => {
            this.calls.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            this.worker.postMessage({ id, kind, ...input });
        });
    }

    stop() {
        if (this.stopped) {
            return;
        }

        this.stopped = true;
        this.worker.terminate();

        for (const call of this.calls.values()) {
            call.reject(new Error('Action canceled.'));
        }

        this.calls.clear();
    }
}
