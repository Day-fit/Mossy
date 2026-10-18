export function vaultKeyId(userId: string, vaultId: string): string {
    return `vault:${JSON.stringify([userId, vaultId])}`;
}

export function userPasskeyId(userId: string): string {
    return `passkey:${userId}`;
}
