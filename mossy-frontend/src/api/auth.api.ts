import { apiFetch } from './client.ts';

export type UserDetailsResponse = {
    userId: string;
    username: string;
    email: string | null;
    grantedAuthorities: string[];
};

export type PublicIdentityJwk = {
    kty: 'OKP';
    crv: 'Ed25519';
    x: string;
};

export type LoginChallenge = {
    deviceId: string;
    challengeId: string;
    signature: string;
};

export type LoginResponse = {
    accessToken: string;
    accessTokenType: 'ACCESS_TOKEN' | 'DEVICE_ENROLLMENT_TOKEN';
};

export type EmailVerification = {
    verificationId: string;
    expiresAt: string;
    resendAvailableAt: string;
};

export type RegistrationResponse = {
    deviceId: string;
    verification: EmailVerification | null;
};

export type ConfirmEmailRequest = { verificationId: string } & (
    | { code: string; token?: never }
    | { token: string; code?: never }
);

export async function executeRegisterRequest(data: {
    username: string;
    email: string;
    password: string;
    publicIdentityKey: PublicIdentityJwk;
}): Promise<RegistrationResponse> {
    return apiFetch('/api/v1/auth/register', {
        includeAuth: false,
        method: 'POST',
        body: JSON.stringify(data),
    }).then((response) => response.json());
}

export async function executeLoginRequest(data: {
    identifier: string;
    password: string;
    challengeDto: LoginChallenge | null;
}): Promise<LoginResponse> {
    return apiFetch('/api/v1/auth/login', {
        includeAuth: false,
        method: 'POST',
        body: JSON.stringify(data),
    }).then((response) => response.json());
}

export async function executeCheckAuthState(data: { token: string }) {
    return apiFetch('/api/v1/auth/status', {
        method: 'GET',
        authToken: data.token,
    });
}

export async function executeUserDetailsRequest() {
    return apiFetch('/api/v1/auth/user/me', {
        method: 'GET',
    }).then((response) => response.json() as Promise<UserDetailsResponse>);
}

export async function executeConfirmEmailRequest(data: ConfirmEmailRequest) {
    return apiFetch('/api/v1/auth/user/confirm', {
        includeAuth: false,
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function executeResendVerificationRequest(verificationId: string) {
    return apiFetch('/api/v1/auth/user/verification/resend', {
        includeAuth: false,
        method: 'POST',
        body: JSON.stringify({ verificationId }),
    }).then(
        (response) =>
            response.json() as Promise<{
                verification: EmailVerification | null;
            }>
    );
}

export async function executeRecoverVerificationRequest(data: {
    identifier: string;
    password: string;
}) {
    return apiFetch('/api/v1/auth/user/verification/recover', {
        includeAuth: false,
        method: 'POST',
        body: JSON.stringify(data),
    }).then(
        (response) =>
            response.json() as Promise<{
                verification: EmailVerification | null;
            }>
    );
}

export async function executeRefreshRequest() {
    return apiFetch('/api/v1/auth/refresh', {
        includeAuth: false,
        method: 'POST',
    });
}

export async function executeLogoutRequest(): Promise<void> {
    await apiFetch('/api/v1/auth/logout', {
        includeAuth: false,
        method: 'POST',
    });
}
