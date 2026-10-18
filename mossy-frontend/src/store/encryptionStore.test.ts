import { beforeEach, expect, it } from 'vitest';
import { useAuthStore } from './authStore.ts';
import { useEncryptionStore } from './encryptionStore.ts';

function signIn(userId: string) {
    useAuthStore.setState({
        isAuthenticated: true,
        userDetails: {
            userId,
            username: userId,
            email: `${userId}@example.test`,
            grantedAuthorities: [],
        },
    });
}

beforeEach(() => {
    signIn('one');
    useEncryptionStore.getState().clearPasskeys();
});

it('locks cached vaults on account changes and rejects a late unlock from the previous account', () => {
    const store = useEncryptionStore.getState();
    store.setPasskey('shared', new Uint8Array([1]), 'one');

    signIn('two');
    expect(store.getPasskey('shared')).toBeUndefined();
    expect(() =>
        store.setPasskey('shared', new Uint8Array([1]), 'one')
    ).toThrow('account changed');
    store.setPasskey('shared', new Uint8Array([2]), 'two');
    expect(store.getPasskey('shared')).toEqual(new Uint8Array([2]));

    signIn('one');
    expect(store.getPasskey('shared')).toBeUndefined();
});

it('clears unlocked vaults on logout even before user details are cleared', () => {
    const store = useEncryptionStore.getState();
    store.setPasskey('vault', new Uint8Array([1]));
    useAuthStore.setState({ isAuthenticated: false });

    expect(store.getPasskey('vault')).toBeUndefined();
    expect(() => store.setPasskey('vault', new Uint8Array([1]))).toThrow(
        'account changed'
    );
});
