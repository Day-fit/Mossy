import { apiFetch } from "./client.ts";

export async function executeRegisterRequest(data: {
    username: string,
    email: string,
    password: string,
}) {
    try {
        return await apiFetch("/api/v1/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        })
    } catch (e) {
        throw e;
    }
}

export async function executeLoginRequest(data: {
    identifier: string,
    password: string,
}) {
    try {
        return await apiFetch("/api/v1/auth/login", {
            method: "POST",
            body: JSON.stringify(data),
        })
    } catch (e) {
        throw e;
    }
}

export async function executeCheckAuthState(data: {
    token: string,
}) {
    try {
        return await apiFetch("/api/v1/auth/status", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${data.token}`,
            },
        })
    } catch (e) {
        throw e;
    }
}

export async function executeConfirmEmailRequest(token: string) {
    try {
        return await apiFetch(`/api/v1/auth/user/confirm/${token}`, {
            method: "GET",
        })
    } catch (e) {
        throw e;
    }
}

export async function executeRefreshRequest() {
    try {
        return await apiFetch("/api/v1/auth/refresh", {
            method: "POST",
        })
    } catch (e) {
        throw e;
    }
}