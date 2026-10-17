import { apiFetch } from './client.ts';
import { readSseData } from './sse.ts';
import type { PublicIdentityJwk } from './auth.api.ts';

export type NonceChallenge = {
    nonce: string;
    expiresAt: string;
    challengeId: string;
};

export type DeviceLoginChallengeResult =
    | { status: 'challenge-ready'; challenge: NonceChallenge }
    | { status: 'enrollment-pending' };

export type DeviceEnrollment = {
    id: string;
    lastOsName: string;
    deviceType: string;
    remoteAddr: string;
    createdAt: string;
};

export type DeviceDetails = {
    id: string;
    lastOsName: string;
    deviceType: string;
    lastSeen: string | null;
    blocked: boolean;
    current: boolean;
};

export async function executeGetDeviceIdentityKeyRequest(
    deviceId: string,
    signal: AbortSignal
): Promise<PublicIdentityJwk> {
    return apiFetch(
        `/api/v1/device-trust/device/${encodeURIComponent(deviceId)}/identity-key`,
        { signal }
    ).then((response) => response.json());
}

// Use fetch so the stream carries the same bearer token as other API requests.
export async function receiveEnrollmentEvents(
    signal: AbortSignal,
    onEnrollment: (enrollment: DeviceEnrollment) => void,
    onOpen: () => void
): Promise<void> {
    const response = await apiFetch(
        '/api/v1/device-trust/device/enrollments/events',
        {
            method: 'GET',
            headers: { Accept: 'text/event-stream' },
            signal,
        }
    );
    if (
        !response.headers.get('Content-Type')?.includes('text/event-stream') ||
        !response.body
    ) {
        throw new Error('Enrollment event stream is unavailable.');
    }

    try {
        if (signal.aborted) return;
        onOpen();
        for await (const payload of readSseData(response)) {
            if (signal.aborted) return;
            // A malformed event must not disconnect the rest of the stream.
            let enrollment: DeviceEnrollment;
            try {
                enrollment = JSON.parse(payload);
            } catch {
                continue;
            }
            if (
                enrollment &&
                typeof enrollment.id === 'string' &&
                typeof enrollment.lastOsName === 'string' &&
                typeof enrollment.deviceType === 'string' &&
                typeof enrollment.remoteAddr === 'string' &&
                typeof enrollment.createdAt === 'string'
            ) {
                onEnrollment(enrollment);
            }
        }
    } finally {
        await response.body.cancel().catch(() => undefined);
    }
}

export async function executeDeviceLoginChallengeRequest(
    deviceId: string
): Promise<DeviceLoginChallengeResult> {
    const response = await apiFetch(`/api/v1/device-trust/nonce/${deviceId}`, {
        includeAuth: false,
        method: 'GET',
    });

    if (response.status === 202) {
        return { status: 'enrollment-pending' };
    }

    return {
        status: 'challenge-ready',
        challenge: await response.json(),
    };
}

export async function executeCreateEnrollmentRequest(data: {
    token: string;
    idempotencyKey: string;
    userAgent: string;
    publicIdentityKey: PublicIdentityJwk;
}): Promise<{ enrollmentId: string; challenge: NonceChallenge }> {
    return apiFetch('/api/v1/device-trust/device/enrollment', {
        method: 'POST',
        authToken: data.token,
        headers: { 'Idempotency-Key': data.idempotencyKey },
        body: JSON.stringify({
            userAgent: data.userAgent,
            publicIdentityKey: data.publicIdentityKey,
        }),
    }).then((response) => response.json());
}

export async function executeConfirmEnrollmentRequest(data: {
    token: string;
    idempotencyKey: string;
    enrollmentId: string;
    challengeId: string;
    signature: string;
}): Promise<{ deviceId: string }> {
    return apiFetch('/api/v1/device-trust/device/enrollment/challenge', {
        method: 'POST',
        authToken: data.token,
        headers: { 'Idempotency-Key': data.idempotencyKey },
        body: JSON.stringify({
            enrollmentId: data.enrollmentId,
            challengeId: data.challengeId,
            signature: data.signature,
        }),
    }).then((response) => response.json());
}

export async function executeGetEnrollmentsRequest(): Promise<
    DeviceEnrollment[]
> {
    return apiFetch('/api/v1/device-trust/device/enrollments', {
        method: 'GET',
    })
        .then((response) => response.json())
        .then(
            (response: { enrollments: DeviceEnrollment[] }) =>
                response.enrollments
        );
}

export async function executeApproveEnrollmentRequest(
    enrollmentId: string
): Promise<void> {
    await apiFetch(
        `/api/v1/device-trust/device/enrollment/${enrollmentId}/approve`,
        { method: 'POST' }
    );
}

export async function executeGetDevicesRequest(): Promise<DeviceDetails[]> {
    return apiFetch('/api/v1/device-trust/devices', { method: 'GET' })
        .then((response) => response.json())
        .then((response: { devices: DeviceDetails[] }) => response.devices);
}

async function executeDeviceBlockStateRequest(
    deviceId: string,
    action: 'block' | 'unblock'
): Promise<void> {
    await apiFetch(`/api/v1/device-trust/device/${action}`, {
        method: 'POST',
        body: JSON.stringify({ targetDeviceId: deviceId }),
    });
}

export async function executeBlockDeviceRequest(
    deviceId: string
): Promise<void> {
    await executeDeviceBlockStateRequest(deviceId, 'block');
}

export async function executeUnblockDeviceRequest(
    deviceId: string
): Promise<void> {
    await executeDeviceBlockStateRequest(deviceId, 'unblock');
}
