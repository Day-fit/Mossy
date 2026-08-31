import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMockRuntime } from "../src/app.js";
import { createIdentity, registerAndAuthenticate, signNonce } from "./helpers.js";

describe("mock HTTP API", () => {
  it("rejects strict DTO violations before mutation", async () => {
    const runtime = createMockRuntime({ scenario: "empty" });
    const before = runtime.store.state.users.length;
    const response = await request(runtime.app)
      .post("/api/v1/auth/register")
      .send({
        username: "valid-name",
        email: "valid@mossy.test",
        password: "Password123!",
        publicIdentityKey: { kty: "OKP", crv: "Ed25519", x: "A".repeat(43) },
        unexpected: true,
      })
      .expect(400);

    expect(response.body.errors[0].field).toContain("body");
    expect(runtime.store.state.users).toHaveLength(before);
  });

  it("supports authenticated, stateful vault/password/tag/note/statistics flows", async () => {
    const runtime = createMockRuntime({ scenario: "empty" });
    const device = await registerAndAuthenticate(runtime, "stateful");
    const auth = { Authorization: `Bearer ${device.accessToken}` };

    await request(runtime.app).get("/api/v1/auth/status").set(auth).expect(200, { isAuthenticated: true });
    const createdVault = await request(runtime.app)
      .post("/api/v1/passwords/vault")
      .set(auth)
      .send({ vaultName: "Test vault" })
      .expect(200);
    const vaultId = createdVault.body.vaultId as string;

    await request(runtime.app)
      .post("/api/v1/passwords/save")
      .set(auth)
      .send({
        identifier: "demo",
        address: "example.test",
        cipherText: "opaque-ciphertext",
        vaultId,
        passwordType: "PASSWORD",
      })
      .expect(200);
    const metadata = await request(runtime.app)
      .get("/api/v1/passwords/metadata")
      .query({ vaultId })
      .set(auth)
      .expect(200);
    expect(metadata.body).toHaveLength(1);
    const passwordId = metadata.body[0].passwordId as string;

    const createdTag = await request(runtime.app)
      .post("/api/v1/passwords/tag")
      .set(auth)
      .send({ vaultId, tagName: "Test", color: "#007735" })
      .expect(201);
    expect(createdTag.headers.location).toContain(vaultId);
    const tags = await request(runtime.app)
      .get(`/api/v1/passwords/vault/${vaultId}/tags`)
      .set(auth)
      .expect(200);
    const tagId = tags.body[0].tagId as string;
    await request(runtime.app)
      .put(`/api/v1/passwords/${passwordId}/tags`)
      .set(auth)
      .send({ vaultId, tagId })
      .expect(204);
    await request(runtime.app)
      .post(`/api/v1/passwords/vault/${vaultId}/password/${passwordId}/note`)
      .set(auth)
      .send({ content: "encrypted-note" })
      .expect(204);

    const refreshedMetadata = await request(runtime.app)
      .get("/api/v1/passwords/metadata")
      .query({ vaultId })
      .set(auth)
      .expect(200);
    expect(refreshedMetadata.body[0]).toMatchObject({ hasNote: true, tags: [{ tagId }] });
    const statistics = await request(runtime.app)
      .get("/api/v1/statistics/dashboard")
      .set(auth)
      .expect(200);
    expect(statistics.body.recentActions[0]).toMatchObject({ actionType: "ADDED", domain: "example.test" });
  });

  it("rotates refresh cookies, reports auth state, and logs out", async () => {
    const runtime = createMockRuntime({ scenario: "empty" });
    const device = await registerAndAuthenticate(runtime, "cookies");
    const refreshed = await request(runtime.app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", device.refreshCookie)
      .expect(200);
    expect(refreshed.body.accessTokenType).toBe("ACCESS_TOKEN");
    await request(runtime.app)
      .get("/api/v1/auth/status")
      .set("Authorization", `Bearer ${refreshed.body.accessToken}`)
      .expect(200, { isAuthenticated: true });
    const rotatedCookie = (refreshed.headers["set-cookie"] as unknown as string[])[0].split(";", 1)[0];
    await request(runtime.app).post("/api/v1/auth/logout").set("Cookie", rotatedCookie).expect(200);
    await request(runtime.app).post("/api/v1/auth/refresh").set("Cookie", rotatedCookie).expect(401);
  });

  it("keeps confirmed devices pending when the scenario disables auto approval", async () => {
    const runtime = createMockRuntime({ scenario: "pending-enrollment" });
    const enrollmentLogin = await request(runtime.app)
      .post("/api/v1/auth/login")
      .send({ identifier: "demo", password: "Mossy123!", challengeDto: null })
      .expect(200);
    const identity = createIdentity();
    const enrollment = await request(runtime.app)
      .post("/api/v1/device-trust/device/enrollment")
      .set("Authorization", `Bearer ${enrollmentLogin.body.accessToken}`)
      .set("Idempotency-Key", "77777777-7777-4777-8777-777777777781")
      .send({ userAgent: "Pending Device", publicIdentityKey: identity.publicJwk })
      .expect(200);
    const confirmation = await request(runtime.app)
      .post("/api/v1/device-trust/device/enrollment/challenge")
      .set("Authorization", `Bearer ${enrollmentLogin.body.accessToken}`)
      .set("Idempotency-Key", "77777777-7777-4777-8777-777777777782")
      .send({
        enrollmentId: enrollment.body.enrollmentId,
        challengeId: enrollment.body.challenge.challengeId,
        signature: signNonce(identity.privateKey, enrollment.body.challenge.nonce),
      })
      .expect(200);
    await request(runtime.app)
      .get(`/api/v1/device-trust/nonce/${confirmation.body.deviceId}`)
      .expect(202);
  });

  it("rejects online-only operations in the offline-vault scenario", async () => {
    const runtime = createMockRuntime({ scenario: "offline-vault" });
    const device = await registerAndAuthenticate(runtime, "offline");
    const auth = { Authorization: `Bearer ${device.accessToken}` };
    const createdVault = await request(runtime.app)
      .post("/api/v1/passwords/vault")
      .set(auth)
      .send({ vaultName: "Still offline" })
      .expect(200);
    await request(runtime.app)
      .post("/api/v1/passwords/save")
      .set(auth)
      .send({
        identifier: "demo",
        address: "example.test",
        cipherText: "opaque",
        vaultId: createdVault.body.vaultId,
        passwordType: "PASSWORD",
      })
      .expect(503);
  });

  it("keeps idempotent enrollment responses stable and rejects changed payloads", async () => {
    const runtime = createMockRuntime({ scenario: "empty" });
    const login = await request(runtime.app)
      .post("/api/v1/auth/login")
      .send({ identifier: "demo", password: "Mossy123!", challengeDto: null })
      .expect(200);
    const token = login.body.accessToken as string;
    const identity = { kty: "OKP", crv: "Ed25519", x: "C".repeat(43) };
    const first = await request(runtime.app)
      .post("/api/v1/device-trust/device/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "77777777-7777-4777-8777-777777777779")
      .send({ userAgent: "Test", publicIdentityKey: identity })
      .expect(200);
    const second = await request(runtime.app)
      .post("/api/v1/device-trust/device/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "77777777-7777-4777-8777-777777777779")
      .send({ userAgent: "Test", publicIdentityKey: identity })
      .expect(200);
    expect(second.body).toEqual(first.body);
    expect(runtime.store.state.enrollments).toHaveLength(1);

    await request(runtime.app)
      .post("/api/v1/device-trust/device/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "77777777-7777-4777-8777-777777777779")
      .send({ userAgent: "Changed", publicIdentityKey: identity })
      .expect(409);
  });

  it("applies validated operation overrides without mutating state", async () => {
    const runtime = createMockRuntime({ scenario: "dashboard-error" });
    const device = await registerAndAuthenticate(runtime, "override");
    const response = await request(runtime.app)
      .get("/api/v1/statistics/dashboard")
      .set("Authorization", `Bearer ${device.accessToken}`)
      .expect(503);
    expect(response.body.message).toContain("Statistics");
    expect(response.headers["x-mock-scenario"]).toBe("dashboard-error");
  });
});
