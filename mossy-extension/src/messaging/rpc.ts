export async function rpc<T>(command: unknown): Promise<T> {
    const response = await chrome.runtime.sendMessage(command);

    if (!response?.ok) {
        throw new Error(
            response?.error ?? 'The extension restarted. Try again.'
        );
    }

    return response.data as T;
}

export class ActionPort {
    private port: chrome.runtime.Port;
    private pending = new Map<
        string,
        { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();

    constructor(id: string, onDisconnect: () => void) {
        this.port = chrome.runtime.connect({ name: `action:${id}` });
        this.port.onMessage.addListener((data) => {
            const call = this.pending.get(data.id);

            if (!call) {
                return;
            }

            this.pending.delete(data.id);

            if (data.error) {
                call.reject(new Error(data.error));

                return;
            }

            call.resolve(data.result);
        });
        this.port.onDisconnect.addListener(() => {
            for (const call of this.pending.values()) {
                call.reject(
                    new Error('This action expired or the extension restarted.')
                );
            }

            this.pending.clear();
            onDisconnect();
        });
    }

    call<T>(kind: string, value?: unknown): Promise<T> {
        const id = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            this.pending.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            this.port.postMessage({
                id,
                kind,
                ...(value !== undefined ? { value } : {}),
            });
        });
    }

    close() {
        this.port.disconnect();
    }
}
