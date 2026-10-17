import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockRuntime } from "../src/app.js";

describe("HTTP key synchronization", () => {
  let runtime: ReturnType<typeof createMockRuntime>;
  let server: Server;
  let base: string;
  let receiverToken: string;
  let senderToken: string;
  let senderId: string;
  const dh = { kty: "OKP", crv: "X25519", x: "A".repeat(43) };

  beforeEach(async () => {
    runtime = createMockRuntime();
    const receiver = runtime.store.state.devices[0];
    const sender = { ...receiver, id: randomUUID() };
    senderId = sender.id;
    runtime.store.state.devices.push(sender);
    receiverToken = runtime.store.issueToken("ACCESS_TOKEN", receiver.userId, receiver.id).token;
    senderToken = runtime.store.issueToken("ACCESS_TOKEN", sender.userId, sender.id).token;
    server = runtime.createHttpServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing mock server address");
    base = `http://127.0.0.1:${address.port}/api/v1/key-sync`;
  });

  afterEach(async () => {
    if (!server.listening) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  function request(path: string, token: string, body?: unknown) {
    return fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async function initialize(vaultId = runtime.store.state.vaults[0].id) {
    const response = await request("", receiverToken, { vaultId, publicDh: dh, signature: "receiver-signature" });
    expect(response.status).toBe(200);
    return (await response.json()) as { code: string };
  }

  it("discovers pending receivers separately, uploads once, and notifies the receiving device", async () => {
    const vaultId = runtime.store.state.vaults[0].id;
    const { code } = await initialize();
    expect(code).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    const pending = await request("/receivers", senderToken).then((response) => response.json());
    expect(pending).toEqual([{ code, receiverId: runtime.store.state.devices[0].id,
      vaultId, publicDh: dh, signature: "receiver-signature" }]);

    const events = await request("/receiver-events", receiverToken);
    const uploaded = await request(`/${code}`, senderToken, { vaultId, ciphertext: "encrypted-key", publicDh: dh });
    expect(uploaded.status).toBe(200);
    expect(await events.text()).toContain('"result":"SUCCESS"');
    expect(await request("/receivers", senderToken).then((response) => response.json())).toEqual([]);
    const response = await request("/vault-keys", receiverToken).then((result) => result.json());
    expect(response).toEqual({ keys: [{ code, vaultId, cipherText: "encrypted-key",
      senderId, senderPublicDh: dh.x }] });
    expect((await request(`/${code}`, senderToken, { vaultId, ciphertext: "replayed", publicDh: dh })).status).toBe(404);
  });

  it("does not expose or consume another account's pending receiver requests", async () => {
    const otherUser = { ...runtime.store.state.users[0], id: randomUUID() };
    const otherDevice = { ...runtime.store.state.devices[0], id: randomUUID(), userId: otherUser.id };
    runtime.store.state.users.push(otherUser);
    runtime.store.state.devices.push(otherDevice);
    const token = runtime.store.issueToken("ACCESS_TOKEN", otherUser.id, otherDevice.id).token;
    const { code } = await initialize();

    expect(await request("/receivers", token).then((response) => response.json())).toEqual([]);
    expect((await request(`/${code}`, token, {
      vaultId: runtime.store.state.vaults[0].id, ciphertext: "wrong-user", publicDh: dh,
    })).status).toBe(404);
    const pending = await request("/receivers", senderToken).then((response) => response.json());
    expect(pending).toHaveLength(1);
    expect(pending[0].code).toBe(code);
  });

  it("returns multiple keys with sender details only to their receiving device", async () => {
    const secondVault = { ...runtime.store.state.vaults[0], id: randomUUID() };
    runtime.store.state.vaults.push(secondVault);
    for (const vault of runtime.store.state.vaults) {
      const { code } = await initialize(vault.id);
      expect((await request(`/${code}`, senderToken, { vaultId: vault.id, ciphertext: vault.id, publicDh: dh })).status).toBe(200);
    }
    const received = await request("/vault-keys", receiverToken).then((response) => response.json());
    expect(received.keys).toHaveLength(runtime.store.state.vaults.length);
    expect(received.keys.every((key: { senderPublicDh: string }) => key.senderPublicDh === dh.x)).toBe(true);
    expect(await request("/vault-keys", senderToken).then((response) => response.json())).toEqual({ keys: [] });
  });
});
