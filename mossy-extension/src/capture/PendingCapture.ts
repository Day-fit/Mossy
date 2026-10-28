import { assertLive } from '../security/security';

export type CaptureMetadata = {
    origin: string;
    identifier: string;
    tabId: number;
    account: string;
};

export type PendingMetadata = CaptureMetadata & {
    id: string;
    deadline: number;
    handedOff: boolean;
};

/** Only ciphertext and a distinct ephemeral key exist between receipt and an authorized consume. Never persisted. */
export class PendingCapture {
    private candidate?: {
        metadata: PendingMetadata;
        key: CryptoKey;
        iv: Uint8Array<ArrayBuffer>;
        ciphertext: ArrayBuffer;
    };
    private timer?: ReturnType<typeof setTimeout>;
    private generation = 0;

    constructor(
        private changed: () => void = () => {},
        private now: () => number = Date.now
    ) {}

    async stage(
        password: string,
        metadata: CaptureMetadata,
        receivedAt = this.now()
    ): Promise<PendingMetadata | undefined> {
        this.clear();

        const generation = this.generation;
        const deadline = receivedAt + 30_000;
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const bytes = new TextEncoder().encode(password);
        let ciphertext: ArrayBuffer;

        try {
            ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                bytes
            );
        } finally {
            bytes.fill(0);
            password = '';
        }

        const isStagingObsolete =
            generation !== this.generation || this.now() >= deadline;
        if (isStagingObsolete) {
            return undefined;
        }

        const pending = {
            ...metadata,
            id: crypto.randomUUID(),
            deadline,
            handedOff: false,
        };
        this.candidate = { metadata: pending, key, iv, ciphertext };
        this.timer = setTimeout(
            () => this.clear(),
            Math.max(0, deadline - this.now())
        );
        this.changed();

        return { ...pending };
    }

    metadata(): PendingMetadata | undefined {
        if (!this.candidate) {
            return;
        }

        const hasExpired = this.now() >= this.candidate.metadata.deadline;
        if (hasExpired) {
            this.clear();

            return;
        }

        return { ...this.candidate.metadata };
    }

    handoff(id: string, account: string): void {
        const pending = this.metadata();
        const candidate = this.candidate;

        const cannotHandOff =
            !pending ||
            !candidate ||
            pending.id !== id ||
            pending.account !== account ||
            pending.handedOff;
        if (cannotHandOff) {
            throw new Error('Capture is unavailable.');
        }

        candidate.metadata.handedOff = true;
    }

    async consume(id: string, account: string): Promise<string> {
        const candidate = this.candidate;

        const cannotConsume =
            !candidate ||
            candidate.metadata.id !== id ||
            candidate.metadata.account !== account ||
            !candidate.metadata.handedOff;
        if (cannotConsume) {
            throw new Error('Capture is unavailable.');
        }

        assertLive(candidate.metadata.deadline, this.now());
        this.clear();

        const bytes = new Uint8Array(
            await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: candidate.iv },
                candidate.key,
                candidate.ciphertext
            )
        );

        try {
            assertLive(candidate.metadata.deadline, this.now());

            return new TextDecoder().decode(bytes);
        } finally {
            bytes.fill(0);
        }
    }

    clearIf(id: string): void {
        if (this.candidate?.metadata.id === id) {
            this.clear();
        }
    }

    clear(): void {
        this.generation++;
        this.candidate = undefined;
        clearTimeout(this.timer);
        this.changed();
    }
}
