import { z } from 'zod';
import { isWebsiteProtocol } from './website';

export const DEFAULT_INSTANCE = 'https://mossy.dayfit.pl';

export function validateInstance(value: string, development = false): void {
    const url = new URL(value);

    if (value !== url.origin) {
        throw new Error(
            'Use a single instance origin without a trailing slash.'
        );
    }

    const isUnsupportedProtocol =
        url.protocol !== 'https:' &&
        !(
            development &&
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        );
    if (isUnsupportedProtocol) {
        throw new Error('Use HTTPS for your Mossy instance.');
    }
}

const id = z.string().min(1).max(256);

export const fillSuggestionsSchema = z.object({ formId: id }).strict();
export const suggestedFillSchema = fillSuggestionsSchema.extend({
    vaultId: id,
    passwordId: id,
});

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

export const discoverSchema = z
    .object({
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
    .strict();

export const captureSchema = z
    .object({
        identifier: z.string().max(2048),
        password: z.string().min(1).max(65536),
        origin: z.url(),
    })
    .strict();

export type DiscoveredForm = z.infer<typeof discoverSchema>['forms'][number];

export const contentMessageSchema = z.discriminatedUnion('kind', [
    discoverSchema.extend({ kind: z.literal('discover') }),
    captureSchema.extend({ kind: z.literal('capture'), formId: id }),
]);

export function trustedPage(
    sender: chrome.runtime.MessageSender,
    path: string
): boolean {
    const { id, url: senderUrl, origin } = sender;
    const isUntrustedPage =
        id !== chrome.runtime.id ||
        !senderUrl ||
        origin !== chrome.runtime.getURL('').replace(/\/$/, '');
    if (isUntrustedPage) {
        return false;
    }

    try {
        const url = new URL(senderUrl);
        const expected = new URL(chrome.runtime.getURL(path));
        return (
            url.protocol === expected.protocol &&
            url.host === expected.host &&
            url.pathname === path
        );
    } catch {
        return false;
    }
}

export function contentSource(
    sender: chrome.runtime.MessageSender,
    instance: string
): { tabId: number; documentId: string; frameId: number; origin: string } {
    const { id, tab, documentId, frameId, url: senderUrl, origin } = sender;
    const tabId = tab?.id;
    const tabUrl = tab?.url;
    const isMissingSourceIdentity =
        id !== chrome.runtime.id ||
        tabId === undefined ||
        !documentId ||
        frameId === undefined ||
        !senderUrl ||
        !tabUrl;
    if (isMissingSourceIdentity) {
        throw new Error('Untrusted source.');
    }

    const url = new URL(senderUrl);
    const top = new URL(tabUrl);

    const isIneligiblePage =
        !isWebsiteProtocol(url.protocol) ||
        top.origin !== url.origin ||
        origin !== url.origin ||
        url.origin === instance;
    if (isIneligiblePage) {
        throw new Error('This page is not eligible.');
    }

    return {
        tabId,
        documentId,
        frameId,
        origin: url.origin,
    };
}

export function assertLive(deadline: number, now = Date.now()): void {
    if (now >= deadline) {
        throw new Error('This captured password has expired.');
    }
}
