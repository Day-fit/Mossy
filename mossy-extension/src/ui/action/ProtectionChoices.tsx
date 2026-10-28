import { motion, useReducedMotion } from 'framer-motion';
import {
    MdAddModerator,
    MdArrowForward,
    MdFingerprint,
    MdPassword,
} from 'react-icons/md';
import type { ProtectionChoice } from './authorization';

type ProtectionChoicesProps = {
    selectChoice: (choice: ProtectionChoice) => void;
};

export default function ProtectionChoices({
    selectChoice,
}: ProtectionChoicesProps) {
    const reduce = useReducedMotion();
    const choices = [
        {
            value: 'use-passkey',
            label: 'Use existing passkey',
            description:
                'Select the passkey already registered for this vault.',
            Icon: MdFingerprint,
        },
        {
            value: 'use-password',
            label: 'Use password',
            description: 'Set a vault password on this browser.',
            Icon: MdPassword,
        },
        {
            value: 'register-passkey',
            label: 'Register new passkey',
            description: 'Create a passkey for this vault.',
            Icon: MdAddModerator,
        },
    ] as const;
    return (
        <div
            role="group"
            aria-label="Vault protection method"
            className="grid gap-2.5"
        >
            {choices.map(({ value, label, description, Icon }) => (
                <motion.button
                    key={value}
                    type="button"
                    className="inline-flex min-h-10 w-full cursor-pointer items-center justify-start gap-3 rounded-[9px] border border-border bg-surface p-3.5 text-left text-[0.8125rem] font-semibold whitespace-normal text-fg-secondary hover:border-fg-brand hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-55 [&>svg]:shrink-0 motion-safe:transition-[transform,background-color,border-color,color]"
                    aria-label={label}
                    aria-describedby={`${value}-description`}
                    disabled={
                        value !== 'use-password' &&
                        typeof PublicKeyCredential === 'undefined'
                    }
                    onClick={() => selectChoice(value)}
                    whileTap={reduce ? undefined : { scale: 0.99 }}
                >
                    <Icon
                        className="text-fg-brand"
                        size={24}
                        aria-hidden="true"
                    />
                    <span className="flex flex-col gap-1">
                        <strong className="text-[0.8125rem]">{label}</strong>
                        <span
                            className="text-xs font-normal text-fg-muted"
                            id={`${value}-description`}
                        >
                            {description}
                        </span>
                    </span>
                    <MdArrowForward
                        className="ml-auto text-fg-muted"
                        size={17}
                        aria-hidden="true"
                    />
                </motion.button>
            ))}
        </div>
    );
}
