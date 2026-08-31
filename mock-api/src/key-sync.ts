import { randomInt } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import sockjs, { type Connection } from "sockjs";
import { RuntimeStore } from "./store.js";
import type { ContractBundle } from "./types.js";
import type { KeySyncRoomManager } from "./operations.js";

type Role = "SENDER" | "RECEIVER";

type Peer = {
  connection: Connection;
  deviceId: string;
  role: Role;
  publicDhKey: string;
  signature: string;
  signatureAccepted: boolean | null;
};

type Room = {
  code: string;
  userId: string;
  receiverId: string;
  vaultId: string;
  peers: Partial<Record<Role, Peer>>;
};

function send(connection: Connection, value: unknown): void {
  if (connection.readyState === 1) connection.write(JSON.stringify(value));
}

export class KeySyncServer implements KeySyncRoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly connections = new Map<Connection, { room: Room; peer: Peer }>();

  constructor(
    private readonly store: RuntimeStore,
    private readonly contracts: ContractBundle,
  ) {}

  createRoom(userId: string, receiverId: string, vaultId: string): string {
    let code: string;
    do code = String(randomInt(1, 1_000_000)).padStart(6, "0");
    while (this.rooms.has(code));
    this.rooms.set(code, { code, userId, receiverId, vaultId, peers: {} });
    return code;
  }

  attach(server: HttpServer): void {
    const endpoint = sockjs.createServer({
      log: (severity, message) => {
        if (severity === "error") console.error(`[sockjs] ${message}`);
      },
    });
    endpoint.on("connection", (connection) => this.handleConnection(connection));
    endpoint.installHandlers(server, { prefix: "/api/v1/ws/key-sync" });
  }

  private handleConnection(connection: Connection): void {
    const syncCode = new URL(connection.url, "http://localhost").searchParams.get("syncCode");
    connection.on("data", (rawMessage) => this.handleData(connection, syncCode, rawMessage));
    connection.on("close", () => this.handleClose(connection));
  }

  private handleData(connection: Connection, syncCode: string | null, rawMessage: string): void {
    let message: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawMessage) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON value");
      message = parsed as Record<string, unknown>;
    } catch {
      send(connection, { message: "Invalid payload" });
      return;
    }

    const existing = this.connections.get(connection);
    if (!existing) {
      this.authenticate(connection, syncCode, message);
      return;
    }

    if (message.type === "SIGNATURE_STATUS") {
      if (!this.validate("wsSignatureStatus", message)) return this.invalid(connection);
      this.handleSignatureStatus(existing.room, existing.peer, message.signatureAccepted as boolean);
      return;
    }
    if (message.type === "KEY_SYNC") {
      if (!this.validate("wsKeySync", message)) return this.invalid(connection);
      this.handleKeySync(existing.room, existing.peer, message);
      return;
    }
    send(connection, { message: "Invalid message type" });
  }

  private authenticate(
    connection: Connection,
    syncCode: string | null,
    message: Record<string, unknown>,
  ): void {
    if (!syncCode || !/^[0-9]{6}$/.test(syncCode) || !this.validate("wsAuthFrame", message)) {
      return this.reject(connection, "FAILED", "Invalid authentication frame");
    }
    const room = this.rooms.get(syncCode);
    if (!room) return this.reject(connection, "NOT_FOUND", "No room with such join code");

    const session = this.store.accessTokens.get(message.accessToken as string);
    const device = session?.deviceId
      ? this.store.state.devices.find((candidate) => candidate.id === session.deviceId)
      : undefined;
    if (
      !session ||
      session.type !== "ACCESS_TOKEN" ||
      session.userId !== room.userId ||
      !device?.approved ||
      device.blocked
    ) {
      return this.reject(connection, "FAILED", "Unauthorized");
    }

    const role: Role = device.id === room.receiverId ? "RECEIVER" : "SENDER";
    if (room.peers[role]) return this.reject(connection, "FAILED", `${role} already in room`);
    const jwk = message.jwkPublicDh as { x: string };
    const peer: Peer = {
      connection,
      deviceId: device.id,
      role,
      publicDhKey: jwk.x,
      signature: message.signature as string,
      signatureAccepted: null,
    };
    room.peers[role] = peer;
    this.connections.set(connection, { room, peer });
    send(connection, { status: "SUCCEEDED", message: null });
    this.notifyPeerDetails(room);
  }

  private notifyPeerDetails(room: Room): void {
    const sender = room.peers.SENDER;
    const receiver = room.peers.RECEIVER;
    if (!sender || !receiver) return;
    send(receiver.connection, {
      type: "PEER_DETAILS",
      peerDeviceId: sender.deviceId,
      peerDhKey: sender.publicDhKey,
      signature: sender.signature,
      vaultId: room.vaultId,
    });
    send(sender.connection, {
      type: "PEER_DETAILS",
      peerDeviceId: receiver.deviceId,
      peerDhKey: receiver.publicDhKey,
      signature: receiver.signature,
      vaultId: room.vaultId,
    });
  }

  private handleSignatureStatus(room: Room, peer: Peer, accepted: boolean): void {
    peer.signatureAccepted = accepted;
    if (!accepted) {
      this.notifySignatureStatus(room, false);
      this.rooms.delete(room.code);
      return;
    }
    if (
      room.peers.SENDER?.signatureAccepted === true &&
      room.peers.RECEIVER?.signatureAccepted === true
    ) {
      this.notifySignatureStatus(room, true);
    }
  }

  private notifySignatureStatus(room: Room, accepted: boolean): void {
    const message = { type: "SIGNATURE_STATUS", signaturesAccepted: accepted };
    if (room.peers.SENDER) send(room.peers.SENDER.connection, message);
    if (room.peers.RECEIVER) send(room.peers.RECEIVER.connection, message);
  }

  private handleKeySync(room: Room, peer: Peer, message: Record<string, unknown>): void {
    if (peer.role !== "SENDER") return send(peer.connection, { message: "Only the sender can send key sync data" });
    if (
      room.peers.SENDER?.signatureAccepted !== true ||
      room.peers.RECEIVER?.signatureAccepted !== true
    ) {
      return send(peer.connection, { message: "Both peer signatures must be accepted before key sync" });
    }
    if (message.vaultId !== room.vaultId) {
      return send(peer.connection, { message: "Key sync message does not belong to this room's vault" });
    }
    const receiver = room.peers.RECEIVER;
    if (!receiver) return send(peer.connection, { message: "Receiver is not connected" });
    send(receiver.connection, message);
  }

  private handleClose(connection: Connection): void {
    const existing = this.connections.get(connection);
    if (!existing) return;
    if (existing.room.peers[existing.peer.role]?.connection === connection) {
      delete existing.room.peers[existing.peer.role];
    }
    this.connections.delete(connection);
  }

  private validate(schemaName: string, value: unknown): boolean {
    const validator = this.contracts.validators.get(schemaName);
    return Boolean(validator?.(value));
  }

  private invalid(connection: Connection): void {
    send(connection, { message: "Invalid payload" });
  }

  private reject(connection: Connection, status: "FAILED" | "NOT_FOUND", message: string): void {
    send(connection, { status, message });
    connection.close();
  }
}
