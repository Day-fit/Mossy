import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRuntime } from "../src/app.js";

const eventsPath = "/api/v1/device-trust/device/enrollments/events";
let runtime: ReturnType<typeof createMockRuntime>;
let server: Server;
let baseUrl: string;
let token: string;
const controllers: AbortController[] = [];

beforeEach(async () => {
  runtime = createMockRuntime();
  runtime.store.settings.autoApproveEnrollments = false;
  const device = runtime.store.state.devices[0];
  token = runtime.store.issueToken("ACCESS_TOKEN", device.userId, device.id).token;
  server = createServer(runtime.app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.abort());
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function openStream(accessToken = token) {
  const controller = new AbortController();
  controllers.push(controller);
  const response = await fetch(baseUrl + eventsPath, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "text/event-stream" },
    signal: controller.signal,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toBe(": connected\n\n");
  return { reader, controller };
}
async function readEvent(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let frame = "";
  while (!frame.includes("\n\n")) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error("Stream closed before delivering an event");
    frame += new TextDecoder().decode(chunk.value);
  }
  expect(frame.startsWith("data: ")).toBe(true);
  return JSON.parse(frame.slice(6).trim());
}
async function post(path: string, payload: unknown, authToken: string, key = randomUUID()) {
  return fetch(baseUrl + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
}

describe("mock enrollment SSE", () => {
  it("rejects missing or enrollment tokens before opening a stream", async () => {
    const missing = await fetch(baseUrl + eventsPath);
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ message: "Unauthorized" });
    const enrollmentToken = runtime.store.issueToken("DEVICE_ENROLLMENT_TOKEN", runtime.store.state.users[0].id, null).token;
    const invalid = await fetch(baseUrl + eventsPath, { headers: { Authorization: `Bearer ${enrollmentToken}` } });
    expect(invalid.status).toBe(401);
  });

  it("broadcasts confirmed enrollments to the owner's streams, matches snapshots, and does not replay idempotent requests", async () => {
    const userId = runtime.store.state.users[0].id;
    const first = await openStream();
    const second = await openStream();
    const otherUser = { ...runtime.store.state.users[0], id: randomUUID(), username: "other", email: "other@mossy.test" };
    const otherDevice = { ...runtime.store.state.devices[0], id: randomUUID(), userId: otherUser.id };
    runtime.store.state.users.push(otherUser);
    runtime.store.state.devices.push(otherDevice);
    const other = await openStream(runtime.store.issueToken("ACCESS_TOKEN", otherUser.id, otherDevice.id).token);
    const enrollmentToken = runtime.store.issueToken("DEVICE_ENROLLMENT_TOKEN", userId, null).token;
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const created = await post("/api/v1/device-trust/device/enrollment", {
      userAgent: "Linux", publicIdentityKey: publicKey.export({ format: "jwk" }),
    }, enrollmentToken);
    expect(created.status).toBe(200);
    const enrollment = await created.json();
    const snapshot = () => fetch(baseUrl + "/api/v1/device-trust/device/enrollments", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json());
    expect(await snapshot()).toEqual({ enrollments: [] });
    const payload = {
      enrollmentId: enrollment.enrollmentId, challengeId: enrollment.challenge.challengeId,
      signature: sign(null, Buffer.from(enrollment.challenge.nonce, "base64url"), privateKey).toString("base64url"),
    };
    const rejected = await post("/api/v1/device-trust/device/enrollment/challenge", { ...payload, signature: "invalid" }, enrollmentToken);
    expect(rejected.status).toBe(401);
    expect(await snapshot()).toEqual({ enrollments: [] });
    const key = randomUUID();
    const confirmed = await post("/api/v1/device-trust/device/enrollment/challenge", payload, enrollmentToken, key);
    expect(confirmed.status).toBe(200);
    const event = await readEvent(first.reader);
    expect(event).toMatchObject({ id: enrollment.enrollmentId, lastOsName: "Linux", deviceType: "Desktop" });
    expect(await readEvent(second.reader)).toEqual(event);
    expect(await snapshot()).toEqual({ enrollments: [event] });
    expect(runtime.contracts.validators.get("enrollmentsResponse")!({ enrollments: [event] })).toBe(true);
    const repeated = await post("/api/v1/device-trust/device/enrollment/challenge", payload, enrollmentToken, key);
    expect(repeated.status).toBe(200);
    // Mark the next frame: a replay or cross-user leak would arrive before this marker.
    runtime.store.enrollmentEvents.emit(userId, { marker: "owner" });
    runtime.store.enrollmentEvents.emit(otherUser.id, { marker: "other" });
    expect(await readEvent(first.reader)).toEqual({ marker: "owner" });
    expect(await readEvent(second.reader)).toEqual({ marker: "owner" });
    expect(await readEvent(other.reader)).toEqual({ marker: "other" });
    first.controller.abort();
    second.controller.abort();
    other.controller.abort();
    await vi.waitFor(() => expect(runtime.store.enrollmentEvents.eventNames()).toEqual([]));
  });

  it("expires streams after ten seconds and permits a fresh subscription", async () => {
    const userId = runtime.store.state.users[0].id;
    const stream = await openStream();
    expect(await stream.reader.read()).toEqual({ done: true, value: undefined });
    expect(runtime.store.enrollmentEvents.listenerCount(userId)).toBe(0);
    const reconnected = await openStream();
    runtime.store.enrollmentEvents.emit(userId, { marker: "reconnected" });
    expect(await readEvent(reconnected.reader)).toEqual({ marker: "reconnected" });
  }, 15_000);
});
