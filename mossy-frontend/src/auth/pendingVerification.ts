import type { EmailVerification } from '../api/auth.api.ts';

export type PendingVerification = {
    verification: EmailVerification;
    identifier: string;
};
const key = 'mossy.pendingEmailVerification';

export function loadPendingVerification(): PendingVerification | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        return value &&
            typeof value.identifier === 'string' &&
            typeof value.verification?.verificationId === 'string' &&
            Number.isFinite(Date.parse(value.verification.expiresAt)) &&
            Number.isFinite(Date.parse(value.verification.resendAvailableAt))
            ? value
            : null;
    } catch {
        return null;
    }
}

export function savePendingVerification(value: PendingVerification) {
    sessionStorage.setItem(key, JSON.stringify(value));
}

export function clearPendingVerification() {
    sessionStorage.removeItem(key);
}
