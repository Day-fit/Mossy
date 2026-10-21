type PasswordFormState =
    | { passwordType: 'PASSWORD'; password: string }
    | { passwordType: 'SSH_KEY'; privateKey: string; publicKey?: string };

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

const PRIVATE_KEY_PATTERN =
    /-----BEGIN (OPENSSH|RSA|DSA|EC|ENCRYPTED|) ?PRIVATE KEY-----[\s\S]+-----END \1 ?PRIVATE KEY-----/;

const PUBLIC_KEY_PATTERN =
    /^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,3}( .*)?$/;

function asObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function validateSshKeyPair(privateKey: string, publicKey?: string) {
    const trimmedPrivateKey = privateKey.trim();
    const trimmedPublicKey = publicKey?.trim();

    if (!trimmedPrivateKey) {
        return 'Private SSH key is required.';
    }

    const isInvalidPrivateKey = !PRIVATE_KEY_PATTERN.test(trimmedPrivateKey);
    if (isInvalidPrivateKey) {
        return 'Private SSH key must be an OpenSSH or PEM private key.';
    }

    const isInvalidPublicKey =
        trimmedPublicKey && !PUBLIC_KEY_PATTERN.test(trimmedPublicKey);
    if (isInvalidPublicKey) {
        return 'Public SSH key must be an OpenSSH public key.';
    }

    return null;
}

export function toSecretPayload(formState: PasswordFormState): SecretPayload {
    if (formState.passwordType === 'SSH_KEY') {
        const validationMessage = validateSshKeyPair(
            formState.privateKey,
            formState.publicKey
        );

        if (validationMessage) {
            throw new Error(validationMessage);
        }

        return {
            kind: 'SSH',
            privateKey: formState.privateKey.trim(),
            publicKey: formState.publicKey?.trim(),
        };
    }

    return {
        kind: 'PASSWORD',
        password: formState.password,
    };
}

export function serializeSecretPayload(formState: PasswordFormState) {
    return JSON.stringify(toSecretPayload(formState));
}

export function parseSecretPayload(decrypted: string): SecretPayload {
    const parsed: unknown = JSON.parse(decrypted);
    const { kind, password, privateKey, publicKey } = asObject(parsed)
        ? parsed
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
        typeof publicKey === 'string';
    if (isSshPayload) {
        return {
            kind: 'SSH',
            privateKey,
            publicKey,
        };
    }

    throw new Error('Unsupported secret payload format');
}
