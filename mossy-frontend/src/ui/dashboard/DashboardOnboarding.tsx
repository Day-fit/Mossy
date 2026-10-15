import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdCheckCircle, MdKey, MdLock, MdStorage } from 'react-icons/md';
import { getDeviceDatabase } from '../../auth/deviceIdentity.ts';
import type { UserVaultDto } from '../../api/vault.api.ts';

export default function DashboardOnboarding({
    vaults,
}: {
    vaults: UserVaultDto[];
}) {
    const [keyVaultId, setKeyVaultId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getDeviceDatabase()
            .then(async (db) => {
                const records = await Promise.all(
                    vaults.map(async (vault) => ({
                        vaultId: vault.vaultId,
                        key: await db.get('keys', vault.vaultId),
                    }))
                );
                if (!cancelled) {
                    setKeyVaultId(
                        records.find(({ key }) => key?.wrappedKey && key?.salt)
                            ?.vaultId ?? null
                    );
                }
            })
            .catch(() => {
                if (!cancelled) setKeyVaultId(null);
            });
        return () => {
            cancelled = true;
        };
    }, [vaults]);

    const hasVault = vaults.length > 0;
    const hasKey = vaults.some((vault) => vault.vaultId === keyVaultId);
    const completed = Number(hasVault) + Number(hasKey);
    const steps = [
        {
            title: 'Install your vault',
            description:
                'Create a vault and follow its self-hosting instructions.',
            to: '/vaults',
            done: hasVault,
            Icon: MdStorage,
        },
        {
            title: 'Sync key',
            description:
                'Sync your vault key from a trusted device. Creating a vault sets up its key on this device automatically.',
            to: '/key-sync',
            done: hasKey,
            Icon: MdKey,
        },
        {
            title: 'Add your first password',
            description:
                'Bring your vault online, then save your first password.',
            to: '/passwords',
            done: false,
            Icon: MdLock,
        },
    ];

    return (
        <section
            className="mx-4 my-2 rounded-md bg-surface p-6 shadow-card"
            aria-labelledby="onboarding-title"
        >
            <h1 id="onboarding-title" className="text-2xl">
                Get started with Mossy
            </h1>
            <p className="mt-2 text-sm text-fg-secondary">
                Set up your vault to start securing your passwords.
            </p>
            <p className="mt-4 text-sm text-fg-muted">
                {completed} of 3 steps complete
            </p>
            <progress
                className="mt-2 h-2 w-full accent-brand"
                value={completed}
                max={3}
                aria-label="Setup progress"
            />
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
                {steps.map(({ title, description, to, done, Icon }) => (
                    <li key={title}>
                        {done ? (
                            <MdCheckCircle
                                className="text-brand"
                                size={24}
                                aria-hidden="true"
                            />
                        ) : (
                            <Icon
                                className="text-fg-muted"
                                size={24}
                                aria-hidden="true"
                            />
                        )}
                        <Link
                            to={to}
                            className="mt-3 inline-block rounded-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                            {title}
                        </Link>
                        {done && (
                            <span className="ml-2 text-sm text-fg-muted">
                                Complete
                            </span>
                        )}
                        <p className="mt-2 text-sm text-fg-secondary">
                            {description}
                        </p>
                    </li>
                ))}
            </ol>
        </section>
    );
}
