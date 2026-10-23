import type { Action, Operation } from '../types/models';
import { assertLive } from '../security/security';

/** An action belongs to one document and is released on completion, cancellation or expiry. */
export class ActionRegistry {
    private actions = new Map<
        string,
        {
            action: Action;
            documentId?: string;
            windowId?: number;
            timer: ReturnType<typeof setTimeout>;
        }
    >();

    constructor(private removed: (action: Action) => void) {}

    async open(action: Action) {
        assertLive(action.deadline);
        this.actions.set(action.id, {
            action,
            timer: setTimeout(
                () => this.delete(action.id),
                action.deadline - Date.now()
            ),
        });
        try {
            const window = await chrome.windows.create({
                url: chrome.runtime.getURL(`/action.html#${action.id}`),
                type: 'popup',
                width: 560,
                height: 620,
                focused: true,
            });
            const entry = this.actions.get(action.id);
            if (entry) entry.windowId = window?.id;
            else if (window?.id !== undefined)
                void chrome.windows.remove(window.id).catch(() => undefined);
        } catch (error) {
            this.delete(action.id);
            throw error;
        }
    }

    get(id: string, operation?: Operation): Action {
        const entry = this.actions.get(id);
        if (!entry) throw new Error('This action expired or was canceled.');
        try {
            assertLive(entry.action.deadline);
        } catch (error) {
            this.delete(id);
            throw error;
        }
        if (operation && entry.action.operation !== operation) {
            throw new Error('This action does not support that operation.');
        }
        return entry.action;
    }

    authorize(
        id: string,
        sender: chrome.runtime.MessageSender,
        claim: boolean
    ) {
        const action = this.get(id);
        const entry = this.actions.get(id)!;
        if (
            !sender.documentId ||
            new URL(sender.url!).hash !== `#${id}` ||
            (entry.documentId ? entry.documentId !== sender.documentId : !claim)
        ) {
            throw new Error('This action belongs to a different document.');
        }
        entry.documentId = sender.documentId;
        return action;
    }

    consume(id: string, operation: Operation) {
        const action = this.get(id, operation);
        this.delete(id, false);
        return action;
    }

    delete(id: string, closeWindow = true) {
        const entry = this.actions.get(id);
        if (!entry) return;
        this.actions.delete(id);
        clearTimeout(entry.timer);
        this.removed(entry.action);
        if (closeWindow && entry.windowId !== undefined) {
            void chrome.windows.remove(entry.windowId).catch(() => undefined);
        }
    }

    clear() {
        for (const id of this.actions.keys()) this.delete(id);
    }

    cancelSource(tabId: number) {
        for (const { action } of this.actions.values()) {
            if (action.sourceTabId === tabId || action.target?.tabId === tabId)
                this.delete(action.id);
        }
    }

    cancelCaptures() {
        for (const { action } of this.actions.values()) {
            if (action.candidateId) this.delete(action.id);
        }
    }

    cancelWebsiteActions() {
        for (const { action } of this.actions.values()) {
            if (action.candidateId || action.target) this.delete(action.id);
        }
    }

    cancelFrame(tabId: number, frameId: number) {
        for (const { action } of this.actions.values()) {
            if (
                action.target?.tabId === tabId &&
                (frameId === 0 || action.target.frameId === frameId)
            )
                this.delete(action.id);
        }
    }
}
