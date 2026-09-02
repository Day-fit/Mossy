import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import request from "supertest";
import type { MockRuntime } from "../src/app.js";

export type AuthenticatedDevice = {
  accessToken: string;
  refreshCookie: string;
  deviceId: string;
  privateKey: KeyObject;
  publicJwk: { kty: "OKP"; crv: "Ed25519"; x: string };
};

export function createIdentity() {
  const pair = generateKeyPairSync("ed25519");
  const exported = pair.publicKey.export({ format: "jwk" }) as { kty: "OKP"; crv: "Ed25519"; x: string };
  return { privateKey: pair.privateKey, publicJwk: exported };
}

export function signNonce(privateKey: KeyObject, nonce: string): string {
  return sign(null, Buffer.from(nonce, "base64url"), privateKey).toString("base64url");
}

export async function registerAndAuthenticate(
  runtime: MockRuntime,
  suffix = "one",
): Promise<AuthenticatedDevice> {
  const identity = createIdentity();
  const identifier = `user-${suffix}`;
  const password = "Password123!";
  const registration = await request(runtime.app)
    .post("/api/v1/auth/register")
    .send({
      username: identifier,
      email: `${identifier}@mossy.test`,
      password,
      publicIdentityKey: identity.publicJwk,
    })
    .expect(200);
  const deviceId = registration.body.deviceId as string;
  const challenge = await request(runtime.app)
    .get(`/api/v1/device-trust/nonce/${deviceId}`)
    .expect(200);
  const login = await request(runtime.app)
    .post("/api/v1/auth/login")
    .send({
      identifier,
      password,
      challengeDto: {
        deviceId,
        challengeId: challenge.body.challengeId,
        signature: signNonce(identity.privateKey, challenge.body.nonce),
      },
    })
    .expect(200);
  return {
    accessToken: login.body.accessToken as string,
    refreshCookie: (login.headers["set-cookie"] as unknown as string[])[0].split(";", 1)[0],
    deviceId,
    ...identity,
  };
}

export async function enrollSecondDevice(
  runtime: MockRuntime,
  identifier: string,
  password: string,
): Promise<AuthenticatedDevice> {
  const identity = createIdentity();
  const enrollmentLogin = await request(runtime.app)
    .post("/api/v1/auth/login")
    .send({ identifier, password, challengeDto: null })
    .expect(200);
  const enrollment = await request(runtime.app)
    .post("/api/v1/device-trust/device/enrollment")
    .set("Authorization", `Bearer ${enrollmentLogin.body.accessToken}`)
    .set("Idempotency-Key", "77777777-7777-4777-8777-777777777771")
    .send({ userAgent: "Test Mobile", publicIdentityKey: identity.publicJwk })
    .expect(200);
  const confirmation = await request(runtime.app)
    .post("/api/v1/device-trust/device/enrollment/challenge")
    .set("Authorization", `Bearer ${enrollmentLogin.body.accessToken}`)
    .set("Idempotency-Key", "77777777-7777-4777-8777-777777777772")
    .send({
      enrollmentId: enrollment.body.enrollmentId,
      challengeId: enrollment.body.challenge.challengeId,
      signature: signNonce(identity.privateKey, enrollment.body.challenge.nonce),
    })
    .expect(200);
  const deviceId = confirmation.body.deviceId as string;
  const challenge = await request(runtime.app)
    .get(`/api/v1/device-trust/nonce/${deviceId}`)
    .expect(200);
  const login = await request(runtime.app)
    .post("/api/v1/auth/login")
    .send({
      identifier,
      password,
      challengeDto: {
        deviceId,
        challengeId: challenge.body.challengeId,
        signature: signNonce(identity.privateKey, challenge.body.nonce),
      },
    })
    .expect(200);
  return {
    accessToken: login.body.accessToken,
    refreshCookie: (login.headers["set-cookie"] as unknown as string[])[0].split(";", 1)[0],
    deviceId,
    ...identity,
  };
}
