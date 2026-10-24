import type { Action as ActionModel } from '../../types/models';

const titles = {
    'copy-password': 'Copy password',
    'copy-username': 'Copy username',
    fill: 'Fill login form',
    save: 'Save password',
    'sync-send': 'Send vault key',
    'sync-receive': 'Receive vault key',
};

export type Phase =
    | 'loading'
    | 'waiting'
    | 'authorize'
    | 'busy'
    | 'done'
    | 'error';
export type ProtectionChoice =
    | 'use-passkey'
    | 'use-password'
    | 'register-passkey';

const protectionDescriptions: Record<ProtectionChoice, string> = {
    'use-passkey': 'Use this vault’s existing passkey.',
    'use-password':
        'Choose a password of at least 12 characters to protect this vault.',
    'register-passkey': 'Register a new passkey for this vault.',
};

export const protectionLabels: Record<ProtectionChoice, string> = {
    'use-passkey': 'Use existing passkey',
    'use-password': 'Save password',
    'register-passkey': 'Register new passkey',
};

export function actionTitle(action: ActionModel | undefined): string {
    return action ? titles[action.operation] : 'Secure action';
}

export function authorizationDescription(
    phase: Phase,
    isProtectingVault: boolean,
    choice: ProtectionChoice | null
): string {
    if (phase === 'waiting') {
        return 'Waiting for a device that has this vault key.';
    }
    if (phase === 'done') {
        return 'All set. You can close this window.';
    }

    if (phase === 'error') {
        return 'This action could not be completed.';
    }

    if (isProtectingVault) {
        return choice
            ? protectionDescriptions[choice]
            : 'Choose how to protect this vault on this browser.';
    }

    return 'Confirm this action with your vault.';
}

export function authorizationError(error: unknown, isSetup: boolean): string {
    const wasPasskeyDismissed =
        error instanceof DOMException && error.name === 'NotAllowedError';
    if (wasPasskeyDismissed) {
        return isSetup
            ? 'The passkey prompt was closed. Try again or choose another method.'
            : 'The passkey prompt was closed. Try again.';
    }

    return error instanceof Error ? error.message : 'Action failed.';
}
