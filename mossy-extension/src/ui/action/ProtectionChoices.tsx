import { Button } from '@mossy/ui';
import type { ProtectionChoice } from './authorization';

type ProtectionChoicesProps = {
    selectChoice: (choice: ProtectionChoice) => void;
};

export default function ProtectionChoices({
    selectChoice,
}: ProtectionChoicesProps) {
    return (
        <div
            role="group"
            aria-label="Vault protection method"
            className="protection-choices"
        >
            <Button
                type="button"
                variant="outline"
                disabled={typeof PublicKeyCredential === 'undefined'}
                onClick={() => selectChoice('use-passkey')}
            >
                Use existing passkey
            </Button>
            <p className="muted">
                Select the passkey already registered for this vault.
            </p>
            <Button
                type="button"
                variant="outline"
                onClick={() => selectChoice('use-password')}
            >
                Use password
            </Button>
            <p className="muted">Set a vault password on this browser.</p>
            <Button
                type="button"
                variant="outline"
                disabled={typeof PublicKeyCredential === 'undefined'}
                onClick={() => selectChoice('register-passkey')}
            >
                Register new passkey
            </Button>
            <p className="muted">Create a passkey for this vault.</p>
        </div>
    );
}
