import { generateKeyPairSync, sign } from "node:crypto";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockRuntime } from "../src/app.js";

const origin = "chrome-extension://amkfdcmiegnfjnaidcoaojapakdcchoj";
let runtime: ReturnType<typeof createMockRuntime>;
let server: Server;
let base: string;

beforeEach(async () => {
  runtime = createMockRuntime();
  server = runtime.createHttpServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  base = `http://127.0.0.1:${address.port}/api/v1/auth`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function post(path: string, cookie = "", payload?: unknown) {
  return fetch(base + path, {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

describe("extension authentication", () => {
  it("reuses signed device login with a separate refresh cookie", async () => {
    const user = runtime.store.state.users[0];
    const device = runtime.store.state.devices[0];
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    device.publicIdentityKey = publicKey.export({ format: "jwk" }) as typeof device.publicIdentityKey;
    const challenge = runtime.store.createChallenge(device, "login");
    const response = await post("/extension/login", "", {
      identifier: user.username, password: user.password,
      challengeDto: {
        deviceId: device.id, challengeId: challenge.id,
        signature: sign(null, Buffer.from(challenge.nonce, "base64url"), privateKey).toString("base64url"),
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessTokenType: "ACCESS_TOKEN" });
    expect(response.headers.get("set-cookie")).toMatch(/^mossyExtensionRefreshToken=/);
    expect(response.headers.get("set-cookie")).toContain("Path=/api/v1/auth/extension");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it("returns an enrollment token without a cookie and rejects incorrect credentials", async () => {
    const user = runtime.store.state.users[0];
    const payload = { identifier: user.username, password: user.password, challengeDto: null };
    const response = await post("/extension/login", "", payload);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessTokenType: "DEVICE_ENROLLMENT_TOKEN" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await post("/extension/login", "", { ...payload, password: "wrong" })).status).toBe(401);
  });

  it("rotates and revokes only the extension session, leaving the website session usable", async () => {
    const device = runtime.store.state.devices[0];
    const web = runtime.store.issueRefreshToken(device.userId, device.id).token;
    const extension = runtime.store.issueRefreshToken(device.userId, device.id).token;
    expect((await post("/extension/refresh", `refreshToken=${web}`)).status).toBe(401);
    expect((await post("/refresh", `mossyExtensionRefreshToken=${extension}`)).status).toBe(400);
    const response = await post("/extension/refresh", `refreshToken=${web}; mossyExtensionRefreshToken=${extension}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessTokenType: "ACCESS_TOKEN" });
    const rotated = response.headers.get("set-cookie")!.split(";")[0];
    expect(rotated).toMatch(/^mossyExtensionRefreshToken=/);
    expect((await post("/extension/refresh", `mossyExtensionRefreshToken=${extension}`)).status).toBe(401);
    const logout = await post("/extension/logout", `refreshToken=${web}; ${rotated}`);
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Path=/api/v1/auth/extension");
    expect((await post("/extension/refresh", rotated)).status).toBe(401);
    expect((await post("/refresh", `refreshToken=${web}`)).status).toBe(200);
    expect((await post("/extension/logout")).status).toBe(200);
  });
});
