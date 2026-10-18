export async function withUserPasskeyLock<T>(
    userId: string,
    operation: () => Promise<T>,
    signal?: AbortSignal
): Promise<T> {
    if (!navigator.locks?.request)
        throw new Error(
            'This browser cannot safely coordinate passkey setup. Use a browser with Web Locks support.'
        );
    return navigator.locks.request(
        `mossy-user-passkey:${userId}`,
        { signal },
        operation
    );
}
