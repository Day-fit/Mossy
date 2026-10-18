import { getDeviceDatabase } from './deviceIdentity.ts';
import { requireActiveUser } from './activeUser.ts';
import { withUserPasskeyLock } from './userPasskeyLock.ts';
import { useAuthStore } from '../store/authStore.ts';
import { userPasskeyId } from '../storage/keyIds.ts';
import type { VaultKeyProtection } from '../types/vaultKey.ts';

// Retain ownership even if persisting the credential ID fails. The durable
// reservation prevents another tab (or a reload) from creating a replacement.
const unsavedCredentials = new Map<string, string>();

export function supportsPasskeys() {
    return (
        typeof PublicKeyCredential !== 'undefined' &&
        typeof navigator.credentials?.create === 'function' &&
        typeof navigator.credentials?.get === 'function'
    );
}

function credential(value: Credential | null): PublicKeyCredential {
    if (!(value instanceof PublicKeyCredential))
        throw new Error('Invalid credential');
    return value;
}

function prfBytes(value: BufferSource | undefined): Uint8Array<ArrayBuffer> {
    if (!value || value.byteLength !== 32)
        throw new Error('PRF is not supported by this passkey.');
    return ArrayBuffer.isView(value)
        ? new Uint8Array(
              new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          )
        : new Uint8Array(value.slice(0));
}

export async function getPasskey(
    credentialId: string,
    salt: Uint8Array<ArrayBuffer>,
    signal?: AbortSignal
) {
    signal?.throwIfAborted();
    const result = credential(
        await navigator.credentials.get({
            signal,
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rpId: location.hostname,
                allowCredentials: [
                    {
                        type: 'public-key',
                        id: Uint8Array.from(
                            atob(
                                credentialId
                                    .replace(/-/g, '+')
                                    .replace(/_/g, '/')
                            ),
                            (char) => char.charCodeAt(0)
                        ),
                    },
                ],
                userVerification: 'required',
                extensions: { prf: { eval: { first: salt } } },
            },
        })
    );
    signal?.throwIfAborted();
    return prfBytes(result.getClientExtensionResults().prf?.results?.first);
}

export async function preparePasskey(
    owner: string,
    signal?: AbortSignal
): Promise<VaultKeyProtection> {
    requireActiveUser(owner);
    if (!supportsPasskeys())
        throw new Error('Passkeys are unavailable on this device.');
    return withUserPasskeyLock(
        owner,
        async () => {
            requireActiveUser(owner);
            signal?.throwIfAborted();
            const db = await getDeviceDatabase();
            const id = userPasskeyId(owner);
            const stored = await db.get('keys', id);
            if (
                stored &&
                stored.type !== 'UserPRF' &&
                stored.type !== 'PendingPRF'
            )
                throw new Error('Invalid user passkey record.');
            let credentialId =
                unsavedCredentials.get(owner) ??
                (stored?.type === 'UserPRF' ? stored.credentialId : undefined);
            const salt = crypto.getRandomValues(new Uint8Array(32));
            let first: BufferSource | undefined;
            requireActiveUser(owner);
            signal?.throwIfAborted();
            if (!credentialId) {
                if (stored?.type === 'PendingPRF') {
                    // A crash or storage failure may have hidden the credential ID.
                    // Discover the existing credential and verify its browser-specific
                    // user handle rather than creating another credential.
                    const recovered = credential(
                        await navigator.credentials.get({
                            signal,
                            publicKey: {
                                challenge: crypto.getRandomValues(
                                    new Uint8Array(32)
                                ),
                                rpId: location.hostname,
                                userVerification: 'required',
                                extensions: { prf: { eval: { first: salt } } },
                            },
                        })
                    );
                    const response = recovered.response;
                    if (
                        !('userHandle' in response) ||
                        !(response.userHandle instanceof ArrayBuffer) ||
                        !stored.userHandle ||
                        response.userHandle.byteLength !==
                            stored.userHandle.byteLength ||
                        !new Uint8Array(response.userHandle).every(
                            (byte, index) => byte === stored.userHandle[index]
                        )
                    )
                        throw new Error(
                            'Select the passkey from the earlier registration for this account and browser.'
                        );
                    credentialId = recovered.id;
                    unsavedCredentials.set(owner, credentialId);
                    await db.put('keys', { type: 'UserPRF', credentialId }, id);
                    unsavedCredentials.delete(owner);
                    first =
                        recovered.getClientExtensionResults().prf?.results
                            ?.first;
                    if (!first)
                        throw new Error(
                            'PRF is not supported by this passkey.'
                        );
                } else {
                    // Commit before opening the native dialog. Never clear an ambiguous
                    // reservation: browser failure does not prove no credential exists.
                    const userHandle = crypto.getRandomValues(
                        new Uint8Array(32)
                    );
                    await db.add(
                        'keys',
                        { type: 'PendingPRF', userHandle },
                        id
                    );
                    try {
                        requireActiveUser(owner);
                        signal?.throwIfAborted();
                    } catch (error) {
                        // No native request has started, so this reservation is safe to release.
                        await db.delete('keys', id);
                        throw error;
                    }
                    const user = useAuthStore.getState().userDetails!;
                    const created = credential(
                        await navigator.credentials.create({
                            signal,
                            publicKey: {
                                rp: { name: 'Mossy', id: location.hostname },
                                challenge: crypto.getRandomValues(
                                    new Uint8Array(32)
                                ),
                                user: {
                                    id: userHandle,
                                    name: user.email,
                                    displayName: user.username,
                                },
                                pubKeyCredParams: [
                                    { type: 'public-key', alg: -8 },
                                    { type: 'public-key', alg: -7 },
                                    { type: 'public-key', alg: -257 },
                                ],
                                authenticatorSelection: {
                                    residentKey: 'required',
                                    userVerification: 'required',
                                },
                                extensions: { prf: { eval: { first: salt } } },
                            },
                        })
                    );
                    credentialId = created.id;
                    unsavedCredentials.set(owner, credentialId);
                    // Ownership belongs to the initiating account even if it signed out.
                    await db.put('keys', { type: 'UserPRF', credentialId }, id);
                    unsavedCredentials.delete(owner);
                    requireActiveUser(owner);
                    signal?.throwIfAborted();
                    const prf = created.getClientExtensionResults().prf;
                    if (!prf?.enabled)
                        throw new Error(
                            'PRF is not supported by this passkey.'
                        );
                    first = prf.results?.first;
                }
            } else if (unsavedCredentials.has(owner)) {
                await db.put('keys', { type: 'UserPRF', credentialId }, id);
                unsavedCredentials.delete(owner);
            }
            requireActiveUser(owner);
            signal?.throwIfAborted();
            const passkey = first
                ? prfBytes(first)
                : await getPasskey(credentialId, salt, signal);
            requireActiveUser(owner);
            signal?.throwIfAborted();
            return {
                userId: owner,
                passkey,
                metadata: { type: 'PRF', credentialId, prfSalt: salt },
            };
        },
        signal
    );
}
