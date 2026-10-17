import { randomInt } from "node:crypto";
import type { Response } from "express";
import { AppError } from "./errors.js";

type PublicDhJwk = { kty: "OKP"; crv: "X25519"; x: string };
type InitRequest = { vaultId: string; publicDh: PublicDhJwk; signature: string };
type UploadRequest = { vaultId: string; ciphertext: string; publicDh: PublicDhJwk };
type SyncInfo = InitRequest & { receiverId: string };
type VaultKey = { code: string; vaultId: string; senderId: string; cipherText: string; senderPublicDh: string; expiresAt: number };
type SyncEvent = { receiverId: string; result: "SUCCESS" | "FAILED"; errorMessage: string | null };

export class KeySyncStore {
  private readonly requests = new Map<string, SyncInfo>();
  private readonly keys = new Map<string, VaultKey[]>();
  private readonly subscribers = new Map<string, Set<Response>>();

  initialize(userId: string, receiverId: string, request: InitRequest): string {
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let code: string;
    do code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
    while (this.requests.has(`${userId}:${code}`));
    this.requests.set(`${userId}:${code}`, { ...request, receiverId });
    return code;
  }

  upload(userId: string, senderId: string, code: string, request: UploadRequest): void {
    const requestKey = `${userId}:${code}`;
    const info = this.requests.get(requestKey);
    this.requests.delete(requestKey);
    if (!info) throw new AppError(404, "Invalid code");
    if (info.vaultId !== request.vaultId) {
      this.publish({ receiverId: info.receiverId, result: "FAILED", errorMessage: "Invalid sender connected" });
      throw new AppError(422, "Invalid key uploaded by sender");
    }
    const keys = this.keys.get(info.receiverId) ?? [];
    keys.push({
      code,
      vaultId: info.vaultId,
      senderId,
      cipherText: request.ciphertext,
      senderPublicDh: request.publicDh.x,
      expiresAt: Date.now() + 5 * 60_000,
    });
    this.keys.set(info.receiverId, keys);
    this.publish({ receiverId: info.receiverId, result: "SUCCESS", errorMessage: null });
  }

  getKeys(receiverId: string) {
    const keys = (this.keys.get(receiverId) ?? []).filter((key) => key.expiresAt > Date.now());
    this.keys.set(receiverId, keys);
    return keys.map(({ expiresAt: _expiresAt, ...key }) => key);
  }

  getPendingReceivers(userId: string) {
    const prefix = `${userId}:`;
    return [...this.requests.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, info]) => ({ code: key.slice(prefix.length), ...info }));
  }

  subscribe(receiverId: string, response: Response): void {
    const subscribers = this.subscribers.get(receiverId) ?? new Set<Response>();
    subscribers.add(response);
    this.subscribers.set(receiverId, subscribers);
    response.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    response.flushHeaders();
    response.write(":connected\n\n");
    const heartbeat = setInterval(() => response.write(":heartbeat\n\n"), 15_000);
    heartbeat.unref();
    response.on("close", () => {
      clearInterval(heartbeat);
      subscribers.delete(response);
      if (!subscribers.size) this.subscribers.delete(receiverId);
    });
  }

  private publish(event: SyncEvent): void {
    for (const response of this.subscribers.get(event.receiverId) ?? []) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
      response.end();
    }
  }
}
