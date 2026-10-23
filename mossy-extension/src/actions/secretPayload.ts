export type PasswordSecretPayload = {
    kind: 'PASSWORD';
    password: string;
};

export type SshSecretPayload = {
    kind: 'SSH';
    privateKey: string;
    publicKey?: string;
};

export type SecretPayload = PasswordSecretPayload | SshSecretPayload;

export function parseSecretPayload(decrypted: string): SecretPayload {
    const parsed: unknown = JSON.parse(decrypted);
    const { kind, password, privateKey, publicKey } =
        typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : {};

    const isPasswordPayload =
        kind === 'PASSWORD' && typeof password === 'string';
    if (isPasswordPayload) {
        return {
            kind: 'PASSWORD',
            password,
        };
    }

    const isSshPayload =
        kind === 'SSH' &&
        typeof privateKey === 'string' &&
        (publicKey === undefined || typeof publicKey === 'string');
    if (isSshPayload) {
        return {
            kind: 'SSH',
            privateKey,
            publicKey,
        };
    }

    throw new Error('Unsupported secret payload format');
}
