import type { AddressInfo } from "node:net";
import request from "supertest";
import SockJS from "sockjs-client";
import { afterEach, describe, expect, it } from "vitest";
import { createMockRuntime } from "../src/app.js";
import { enrollSecondDevice, registerAndAuthenticate } from "./helpers.js";

type Message = Record<string, unknown>;

class Inbox {
  private readonly queued: Message[] = [];
  private readonly waiting: { predicate: (message: Message) => boolean; resolve: (message: Message) => void }[] = [];

  push(message: Message): void {
    const index = this.waiting.findIndex((waiter) => waiter.predicate(message));
    if (index < 0) {
      this.queued.push(message);
      return;
    }
    const [waiter] = this.waiting.splice(index, 1);
    waiter.resolve(message);
  }

  waitFor(predicate: (message: Message) => boolean): Promise<Message> {
    const index = this.queued.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.queued.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for SockJS message")), 3000);
      this.waiting.push({
        predicate,
        resolve: (message) => {
          clearTimeout(timeout);
          resolve(message);
        },
      });
    });
  }
}

function openSocket(url: string): Promise<{ socket: InstanceType<typeof SockJS>; inbox: Inbox }> {
  return new Promise((resolve, reject) => {
    const socket = new SockJS(url);
    const inbox = new Inbox();
    socket.onmessage = (event) => inbox.push(JSON.parse(event.data) as Message);
    socket.onerror = () => reject(new Error("SockJS connection failed"));
    socket.onopen = () => resolve({ socket, inbox });
  });
}

describe("SockJS key sync", () => {
  const openSockets: InstanceType<typeof SockJS>[] = [];
  afterEach(() => {
    for (const socket of openSockets) socket.close();
    openSockets.length = 0;
  });

  it("pairs authenticated clients and relays key data after signature acceptance", async () => {
    const runtime = createMockRuntime({ scenario: "empty" });
    const server = runtime.createHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const sender = await registerAndAuthenticate(runtime, "pair");
      const receiver = await enrollSecondDevice(
        runtime,
        "user-pair",
        "Password123!",
      );
      const vault = await request(runtime.app)
        .post("/api/v1/passwords/vault")
        .set("Authorization", `Bearer ${sender.accessToken}`)
        .send({ vaultName: "Synced" })
        .expect(200);
      const room = await request(runtime.app)
        .post("/api/v1/key-sync/init")
        .set("Authorization", `Bearer ${receiver.accessToken}`)
        .send({ vaultId: vault.body.vaultId })
        .expect(200);
      const port = (server.address() as AddressInfo).port;
      const url = `http://127.0.0.1:${port}/api/v1/ws/key-sync?syncCode=${room.body.code}`;
      const receiverConnection = await openSocket(url);
      const senderConnection = await openSocket(url);
      openSockets.push(receiverConnection.socket, senderConnection.socket);

      receiverConnection.socket.send(
        JSON.stringify({
          type: "AUTH_FRAME",
          accessToken: receiver.accessToken,
          signature: "receiver-signature",
          jwkPublicDh: { kty: "OKP", crv: "X25519", x: "R".repeat(43) },
        }),
      );
      senderConnection.socket.send(
        JSON.stringify({
          type: "AUTH_FRAME",
          accessToken: sender.accessToken,
          signature: "sender-signature",
          jwkPublicDh: { kty: "OKP", crv: "X25519", x: "S".repeat(43) },
        }),
      );

      await receiverConnection.inbox.waitFor((message) => message.status === "SUCCEEDED");
      await senderConnection.inbox.waitFor((message) => message.status === "SUCCEEDED");
      const receiverPeer = await receiverConnection.inbox.waitFor((message) => message.type === "PEER_DETAILS");
      const senderPeer = await senderConnection.inbox.waitFor((message) => message.type === "PEER_DETAILS");
      expect(receiverPeer.peerDeviceId).toBe(sender.deviceId);
      expect(senderPeer.peerDeviceId).toBe(receiver.deviceId);

      receiverConnection.socket.send(JSON.stringify({ type: "SIGNATURE_STATUS", signatureAccepted: true }));
      senderConnection.socket.send(JSON.stringify({ type: "SIGNATURE_STATUS", signatureAccepted: true }));
      await receiverConnection.inbox.waitFor(
        (message) => message.type === "SIGNATURE_STATUS" && message.signaturesAccepted === true,
      );
      await senderConnection.inbox.waitFor(
        (message) => message.type === "SIGNATURE_STATUS" && message.signaturesAccepted === true,
      );

      senderConnection.socket.send(
        JSON.stringify({
          type: "KEY_SYNC",
          ciphertext: "ciphertext",
          nonce: "nonce",
          signature: "signature",
          vaultId: vault.body.vaultId,
        }),
      );
      const relayed = await receiverConnection.inbox.waitFor((message) => message.type === "KEY_SYNC");
      expect(relayed).toMatchObject({ ciphertext: "ciphertext", vaultId: vault.body.vaultId });
    } finally {
      for (const socket of openSockets) socket.close();
      openSockets.length = 0;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15_000);
});
