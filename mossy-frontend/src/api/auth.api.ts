import { apiFetch } from "./client.ts";

export function signup(data: {
    username: string,
    email: string,
    password: string,
}) {
    return apiFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
    })
}

export function confirmEmail(token: string) {
    return apiFetch(`/api/v1/auth/user/confirm/${token}`, {
        method: "GET",
    })
}