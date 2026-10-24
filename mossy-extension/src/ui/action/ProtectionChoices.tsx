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
            className="protection-choices"
        >
            {choices.map(({ value, label, description, Icon }) => (
                <motion.button
                    key={value}
                    type="button"
                    className="choice-card"
                    aria-label={label}
                    aria-describedby={`${value}-description`}
                    disabled={
                        value !== 'use-password' &&
                        typeof PublicKeyCredential === 'undefined'
                    }
                    onClick={() => selectChoice(value)}
                    whileTap={reduce ? undefined : { scale: 0.99 }}
                >
                    <Icon size={24} aria-hidden="true" />
                    <span>
                        <strong>{label}</strong>
                        <span id={`${value}-description`}>{description}</span>
                    </span>
                    <MdArrowForward size={17} aria-hidden="true" />
                </motion.button>
            ))}
        </div>
    );
}
