export const WEBSITE_ORIGINS = ['http://*/*', 'https://*/*'];

export function isWebsiteProtocol(protocol: string) {
    return protocol === 'http:' || protocol === 'https:';
}

export function matchesSite(address: string, target: string): boolean {
    if (!/^https?:\/\//i.test(address)) return false;

    try {
        const stored = new URL(address);
        const destination = new URL(target);

        return (
            isWebsiteProtocol(stored.protocol) &&
            !stored.username &&
            !stored.password &&
            !destination.username &&
            !destination.password &&
            stored.origin === destination.origin
        );
    } catch {
        return false;
    }
}
