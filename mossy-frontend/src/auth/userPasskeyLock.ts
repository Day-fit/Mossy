const pending = new Map<string, Promise<unknown>>();

export async function withUserPasskeyLock<T>(
    userId: string,
    operation: () => Promise<T>,
    signal?: AbortSignal
): Promise<T> {
    const name = `mossy-user-passkey:${userId}`;

    if (navigator.locks?.request) {
        return navigator.locks.request(name, { signal }, async () => {
            signal?.throwIfAborted();
            return operation();
        });
    }

    // Serialize requests in this tab when the browser has no Web Locks API.
    const previous = pending.get(name) ?? Promise.resolve();
    const current = previous
        .catch(() => undefined)
        .then(() => {
            signal?.throwIfAborted();
            return operation();
        });
    pending.set(name, current);

    try {
        return await current;
    } finally {
        if (pending.get(name) === current) pending.delete(name);
    }
}
