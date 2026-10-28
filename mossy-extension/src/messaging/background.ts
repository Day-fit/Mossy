import type { ExtensionMessage, Message } from '@webext-core/messaging';
import {
    messaging,
    type ExtensionProtocol,
    type PopupToBackgroundProtocol,
} from './rpc';
import { trustedPage } from '../security/security';

export type MessageHandler<K extends keyof ExtensionProtocol> = (
    message: Message<ExtensionProtocol, K> & ExtensionMessage
) =>
    | ReturnType<ExtensionProtocol[K]>
    | Promise<ReturnType<ExtensionProtocol[K]>>;

export function onPageMessage<K extends keyof ExtensionProtocol>(
    name: K,
    pages: readonly string[],
    handler: MessageHandler<K>
) {
    return messaging.onMessage(name, async (message) => {
        if (!pages.some((page) => trustedPage(message.sender, page))) {
            throw new Error('Untrusted extension page.');
        }
        return handler(message);
    });
}

export function onPopupMessage<K extends keyof PopupToBackgroundProtocol>(
    name: K,
    handler: MessageHandler<K>
) {
    return onPageMessage(name, ['/popup.html'], handler);
}
