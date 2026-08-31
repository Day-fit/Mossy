import { randomBytes, randomUUID } from "node:crypto";
import type {
  DeviceRecord,
  ScenarioSettings,
  ScenarioState,
  TokenSession,
  TokenType,
} from "./types.js";

export type ChallengeRecord = {
  id: string;
  nonce: string;
  expiresAt: string;
  deviceId: string;
  userId: string;
  purpose: "login" | "enrollment";
};

export class RuntimeStore {
  readonly state: ScenarioState;
  readonly settings: ScenarioSettings;
  readonly accessTokens = new Map<string, TokenSession>();
  readonly refreshTokens = new Map<string, TokenSession>();
  readonly challenges = new Map<string, ChallengeRecord>();
  readonly idempotency = new Map<string, unknown>();

  constructor(state: ScenarioState, settings: ScenarioSettings) {
    this.state = structuredClone(state);
    this.settings = structuredClone(settings);
  }

  issueToken(type: TokenType, userId: string, deviceId: string | null): TokenSession {
    const prefix = type === "ACCESS_TOKEN" ? "mock-at" : "mock-et";
    const session = { token: `${prefix}-${randomUUID()}`, type, userId, deviceId };
    this.accessTokens.set(session.token, session);
    return session;
  }

  issueRefreshToken(userId: string, deviceId: string): TokenSession {
    const session: TokenSession = {
      token: `mock-rt-${randomUUID()}`,
      type: "ACCESS_TOKEN",
      userId,
      deviceId,
    };
    this.refreshTokens.set(session.token, session);
    return session;
  }

  createChallenge(device: DeviceRecord, purpose: ChallengeRecord["purpose"]): ChallengeRecord {
    const challenge: ChallengeRecord = {
      id: randomUUID(),
      nonce: randomBytes(32).toString("base64url"),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      deviceId: device.id,
      userId: device.userId,
      purpose,
    };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  findUser(identifier: string) {
    const normalized = identifier.toLowerCase();
    return this.state.users.find(
      (user) => user.username.toLowerCase() === normalized || user.email?.toLowerCase() === normalized,
    );
  }
}
