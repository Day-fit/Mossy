import type { PasswordFormState, WebsiteProtocol } from './index.ts';

export function splitWebsiteAddress(
    input: string,
    protocol: WebsiteProtocol = 'https://'
): { protocol: WebsiteProtocol; address: string } {
    const match = input.trimStart().match(/^(https?:\/\/)/i);

    if (!match) return { protocol, address: input };

    return {
        protocol: match[0].toLowerCase() === 'http://' ? 'http://' : 'https://',
        address: input.trimStart().slice(match[0].length),
    };
}

export function normalizePasswordAddress(form: PasswordFormState) {
    const isWebsite = form.passwordType === 'PASSWORD';
    const protocol = isWebsite ? form.protocol : 'ssh://';
    const address = form.address
        .trim()
        .replace(isWebsite ? /^https?:\/\//i : /^ssh:\/\//i, '');
    const message = isWebsite
        ? 'Enter a valid website address, such as example.com.'
        : 'Enter a valid host, such as server.example:2222.';

    if (!address || /\s|:\/\//.test(address)) throw new Error(message);

    let url: URL;

    try {
        url = new URL(`${protocol}${address}`);
    } catch {
        throw new Error(message);
    }

    if (!url.hostname || url.username || url.password) throw new Error(message);

    return isWebsite ? url.origin : url.host;
}
