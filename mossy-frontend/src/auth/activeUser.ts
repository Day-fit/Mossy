import { useAuthStore } from '../store/authStore.ts';

export function requireActiveUser(userId: string | undefined): string {
    if (!userId) throw new Error('User details not available.');

    if (
        useAuthStore.getState().isAuthenticated === false ||
        useAuthStore.getState().userDetails?.userId !== userId
    ) {
        throw new Error('Your account changed. Please try again.');
    }

    return userId;
}
