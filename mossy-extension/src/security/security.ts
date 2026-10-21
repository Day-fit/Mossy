import { z } from 'zod';

export const DEFAULT_INSTANCE = 'https://mossy.dayfit.pl';

export function normalizeInstance(value: string, development = false): string {
    const url = new URL(value);

    if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.pathname !== '/' && url.pathname !== '')
    ) {
        throw new Error('Use a single instance origin.');
    }

    if (
        url.protocol !== 'https:' &&
        !(
            development &&
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        )
    ) {
        throw new Error('Use HTTPS for your Mossy instance.');
    }

    return url.origin;
}

export function matchesSite(address: string, target: string): boolean {
    try {
        const origin = new URL(target);

        if (
            origin.protocol !== 'https:' ||
            origin.username ||
            origin.password
        ) {
            return false;
        }

        if (address.includes('://')) {
            const stored = new URL(address);

            return (
                stored.protocol === 'https:' &&
                !stored.username &&
                !stored.password &&
                stored.origin === origin.origin
            );
        }

        return (
            !address.includes('/') &&
            !address.includes(':') &&
            address.toLowerCase() === origin.hostname &&
            origin.port === ''
        );
    } catch {
        return false;
    }
}

const id = z.string().min(1).max(256);

export const targetSchema = z
    .object({
        tabId: z.number().int().nonnegative(),
        documentId: id,
        frameId: z.number().int().nonnegative(),
        origin: z.url(),
        formId: id,
        usernameId: id.nullable(),
        passwordId: id,
    })
    .strict();

export type Target = z.infer<typeof targetSchema>;

export const contentMessageSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('discover'),
            forms: z
                .array(
                    targetSchema.omit({
                        tabId: true,
                        documentId: true,
                        frameId: true,
                    })
                )
                .max(30),
        })
        .strict(),
    z
        .object({
            kind: z.literal('capture'),
            formId: id,
            identifier: z.string().max(2048),
            password: z.string().min(1).max(65536),
            origin: z.url(),
        })
        .strict(),
]);

export function trustedPage(
    sender: chrome.runtime.MessageSender,
    path: string
): boolean {
    if (
        sender.id !== chrome.runtime.id ||
        !sender.url ||
        sender.origin !== chrome.runtime.getURL('').replace(/\/$/, '')
    ) {
        return false;
    }

    const url = new URL(sender.url);

    return url.pathname === path;
}

export function contentSource(
    sender: chrome.runtime.MessageSender,
    instance: string
): { tabId: number; documentId: string; frameId: number; origin: string } {
    if (
        sender.id !== chrome.runtime.id ||
        !sender.tab?.id ||
        !sender.documentId ||
        sender.frameId === undefined ||
        !sender.url ||
        !sender.tab.url
    ) {
        throw new Error('Untrusted source.');
    }

    const url = new URL(sender.url);
    const top = new URL(sender.tab.url);

    if (
        url.protocol !== 'https:' ||
        top.origin !== url.origin ||
        sender.origin !== url.origin ||
        url.origin === instance
    ) {
        throw new Error('This page is not eligible.');
    }

    return {
        tabId: sender.tab.id,
        documentId: sender.documentId,
        frameId: sender.frameId,
        origin: url.origin,
    };
}

export function assertLive(deadline: number, now = Date.now()): void {
    if (now >= deadline) {
        throw new Error('This captured password has expired.');
    }
}
