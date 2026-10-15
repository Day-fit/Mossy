import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    MdArrowForward,
    MdCheck,
    MdKey,
    MdLock,
    MdStorage,
} from 'react-icons/md';
import { motion, useReducedMotion } from 'framer-motion';
import SectionLeaves from '../shared/SectionLeaves.tsx';
import { getDeviceDatabase } from '../../auth/deviceIdentity.ts';
import type { UserVaultDto } from '../../api/vault.api.ts';

export default function DashboardOnboarding({
    vaults,
}: {
    vaults: UserVaultDto[];
}) {
    const reducedMotion = useReducedMotion();
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
            action: 'Create your vault',
            done: hasVault,
            Icon: MdStorage,
        },
        {
            title: 'Sync key',
            description: hasKey
                ? 'Your vault key is ready on this device.'
                : 'Bring your vault key over from a trusted device, or create one with a new vault.',
            to: '/key-sync',
            action: 'Sync your key',
            done: hasKey,
            Icon: MdKey,
        },
        {
            title: 'Add your first password',
            description:
                'Bring your vault online, then save your first password.',
            to: '/passwords',
            action: 'Add a password',
            done: false,
            Icon: MdLock,
        },
    ];
    const nextStep = steps.findIndex((step) => !step.done);

    return (
        <motion.section
            className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10"
            aria-labelledby="onboarding-title"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
        >
            <div className="grid overflow-hidden rounded-md border border-border bg-surface shadow-card md:grid-cols-[2fr_3fr]">
                <div className="relative flex items-center border-b border-border bg-brand/5 px-6 py-7 sm:px-8 sm:py-8 md:border-r md:border-b-0">
                    <div className="pointer-events-none absolute inset-0 opacity-45">
                        <SectionLeaves variant="sprigs" />
                    </div>
                    <div className="relative">
                        <h1
                            id="onboarding-title"
                            className="max-w-sm text-3xl leading-tight"
                        >
                            Get started{' '}
                            <span className="block text-brand">with Mossy</span>
                        </h1>
                        <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-secondary">
                            A home for your passwords, on your own server. Let’s
                            get your first vault ready.
                        </p>
                    </div>
                </div>
                <div className="px-5 py-6 sm:px-6 sm:py-7">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg">Your first steps</h2>
                        <p
                            className="text-xs text-fg-muted sm:text-sm"
                            aria-live="polite"
                        >
                            {completed} of 3 steps complete
                        </p>
                    </div>
                    <progress
                        className="sr-only"
                        value={completed}
                        max={3}
                        aria-label="Setup progress"
                    />
                    <div
                        className="mt-4 grid grid-cols-3 gap-2"
                        aria-hidden="true"
                    >
                        {steps.map((step, index) => (
                            <div
                                key={step.title}
                                className={`h-1.5 rounded-full ${step.done ? 'bg-brand' : index === nextStep ? 'bg-brand/30' : 'bg-border'}`}
                            />
                        ))}
                    </div>
                    <ol className="mt-5 space-y-2">
                        {steps.map(
                            (
                                { title, description, to, done, action, Icon },
                                index
                            ) => {
                                const isNext = index === nextStep;
                                return (
                                    <li key={title}>
                                        <Link
                                            to={to}
                                            aria-label={title}
                                            aria-current={
                                                isNext ? 'step' : undefined
                                            }
                                            className={`group flex gap-4 rounded-md border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${isNext ? 'border-brand/25 bg-brand/5 hover:bg-brand/10' : 'border-transparent hover:bg-surface-subtle'}`}
                                        >
                                            <span
                                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand text-fg-inverse' : isNext ? 'bg-brand/10 text-brand' : 'bg-surface-muted text-fg-muted'}`}
                                            >
                                                {done ? (
                                                    <MdCheck
                                                        size={20}
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <Icon
                                                        size={20}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="mb-1 flex items-center gap-2 text-xs text-fg-muted">
                                                    Step 0{index + 1}
                                                    {done && (
                                                        <span className="text-brand">
                                                            {' '}
                                                            · Complete
                                                        </span>
                                                    )}
                                                    {isNext && (
                                                        <span className="text-brand">
                                                            {' '}
                                                            · Up next
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block font-heading text-base leading-snug">
                                                    {title}
                                                </span>
                                                <span className="mt-2 block text-sm leading-relaxed text-fg-secondary">
                                                    {description}
                                                </span>
                                                {isNext && (
                                                    <span className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-fg-inverse group-hover:bg-brand-hover">
                                                        {action}
                                                        <MdArrowForward
                                                            size={17}
                                                            aria-hidden="true"
                                                        />
                                                    </span>
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            }
                        )}
                    </ol>
                </div>
            </div>
        </motion.section>
    );
}
