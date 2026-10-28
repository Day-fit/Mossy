import { useEffect } from 'react';
import type { Scope } from '../../types/vault';
import { selectVaultName, useVaultStore } from './useVaultStore';

export function useVaultName(scope: Scope | undefined) {
    const name = useVaultStore((state) =>
        scope ? selectVaultName(state, scope) : undefined
    );
    const load = useVaultStore((state) => state.load);
    const instance = scope?.instance;
    const accountId = scope?.accountId;

    useEffect(() => {
        if (instance && accountId) {
            // A display-name lookup must not prevent vault authorization.
            void load().catch(() => undefined);
        }
    }, [instance, accountId, load]);

    return name;
}
