import {
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as verifySignature,
} from "node:crypto";
import type { Request, Response } from "express";
import { AppError, requireValue } from "./errors.js";
import { RuntimeStore } from "./store.js";
import type {
  ActionType,
  AuthContext,
  DeviceRecord,
  OperationResult,
  PasswordRecord,
  PublicJwk,
  TagRecord,
  VaultRecord,
} from "./types.js";

export type KeySyncRoomManager = {
  createRoom(userId: string, receiverId: string, vaultId: string): string;
};

export type OperationContext = {
  request: Request;
  response: Response;
  auth: AuthContext;
  store: RuntimeStore;
  keySync: KeySyncRoomManager;
};

export type OperationHandler = (context: OperationContext) => OperationResult | Promise<OperationResult>;

type Body = Record<string, unknown>;

function body(context: OperationContext): Body {
  return context.request.body as Body;
}

function param(context: OperationContext, name: string): string {
  const value = context.request.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function userId(context: OperationContext): string {
  return requireValue(context.auth.user?.id, 401, "Unauthorized");
}

function deviceId(context: OperationContext): string {
  return requireValue(context.auth.device?.id, 401, "Unauthorized");
}

function now(): string {
  return new Date().toISOString();
}

function deviceDescription(userAgent: string): { lastOsName: string; deviceType: string } {
  const lastOsName = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad/i.test(userAgent)
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Mac OS|Macintosh/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown";
  const deviceType = /Mobile|Android|iPhone|iPad/i.test(userAgent) ? "Mobile" : "Desktop";
  return { lastOsName, deviceType };
}

function verifyNonce(nonce: string, signature: string, publicIdentityKey: PublicJwk): boolean {
  try {
    const key = createPublicKey({ key: publicIdentityKey, format: "jwk" });
    return verifySignature(
      null,
      Buffer.from(nonce, "base64url"),
      key,
      Buffer.from(signature, "base64url"),
    );
  } catch {
    return false;
  }
}

function setRefreshCookie(response: Response, token: string): void {
  response.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function requireVault(context: OperationContext, id: string, online = false): VaultRecord {
  const vault = context.store.state.vaults.find(
    (candidate) => candidate.id === id && candidate.userId === userId(context),
  );
  if (!vault) throw new AppError(404, `Vault ${id} does not exist`);
  if (online && !vault.isOnline) throw new AppError(503, `Vault ${id} is not connected`);
  return vault;
}

function requirePassword(context: OperationContext, id: string, vaultId: string): PasswordRecord {
  requireVault(context, vaultId, true);
  const password = context.store.state.passwords.find(
    (candidate) =>
      candidate.id === id && candidate.vaultId === vaultId && candidate.userId === userId(context),
  );
  if (!password) throw new AppError(404, "Password does not exist");
  return password;
}

function requireTag(context: OperationContext, id: string, vaultId: string): TagRecord {
  requireVault(context, vaultId, true);
  const tag = context.store.state.tags.find(
    (candidate) => candidate.id === id && candidate.vaultId === vaultId && candidate.userId === userId(context),
  );
  if (!tag) throw new AppError(404, "Tag does not exist");
  return tag;
}

function recordEvent(
  context: OperationContext,
  password: PasswordRecord,
  actionType: ActionType,
  domain = password.address,
): void {
  context.store.state.events.push({
    id: randomUUID(),
    userId: password.userId,
    vaultId: password.vaultId,
    passwordId: password.id,
    domain,
    actionType,
    date: now(),
  });
}

function idempotent(
  context: OperationContext,
  operation: string,
  compute: () => OperationResult,
): OperationResult {
  const idempotencyKey = String(context.request.headers["idempotency-key"]);
  const key = `${operation}:${userId(context)}:${idempotencyKey}`;
  const serializedBody = JSON.stringify(context.request.body);
  const existing = context.store.idempotency.get(key) as
    | { serializedBody: string; result: OperationResult }
    | undefined;
  if (existing) {
    if (existing.serializedBody !== serializedBody) {
      throw new AppError(409, "Idempotency key was already used with a different request");
    }
    return structuredClone(existing.result);
  }
  const result = compute();
  context.store.idempotency.set(key, { serializedBody, result: structuredClone(result) });
  return result;
}

const authRegister: OperationHandler = (context) => {
  const payload = body(context) as {
    username: string;
    email: string;
    password: string;
    publicIdentityKey: PublicJwk;
  };
  const duplicate = context.store.state.users.some(
    (user) =>
      user.username.toLowerCase() === payload.username.toLowerCase() ||
      user.email?.toLowerCase() === payload.email.toLowerCase(),
  );
  if (duplicate) throw new AppError(409, "User already exists");

  const createdUserId = randomUUID();
  const createdDeviceId = randomUUID();
  const seenAt = now();
  const userAgent = context.request.get("user-agent") ?? "Unknown";
  const description = deviceDescription(userAgent);
  context.store.state.users.push({
    id: createdUserId,
    username: payload.username,
    email: payload.email,
    password: payload.password,
    grantedAuthorities: ["ROLE_USER"],
  });
  context.store.state.devices.push({
    id: createdDeviceId,
    userId: createdUserId,
    publicIdentityKey: payload.publicIdentityKey,
    ...description,
    remoteAddr: context.request.ip ?? "127.0.0.1",
    lastSeen: seenAt,
    blocked: false,
    approved: true,
  });
  return { body: { deviceId: createdDeviceId } };
};

const authLogin: OperationHandler = (context) => {
  const payload = body(context) as {
    identifier: string;
    password: string;
    challengeDto: null | { deviceId: string; challengeId: string; signature: string };
  };
  const user = context.store.findUser(payload.identifier);
  if (!user || user.password !== payload.password) throw new AppError(401, "Bad credentials");

  if (!payload.challengeDto) {
    const enrollment = context.store.issueToken("DEVICE_ENROLLMENT_TOKEN", user.id, null);
    return { body: { accessToken: enrollment.token, accessTokenType: enrollment.type } };
  }

  const device = context.store.state.devices.find(
    (candidate) => candidate.id === payload.challengeDto?.deviceId && candidate.userId === user.id,
  );
  if (!device) throw new AppError(401, "Bad credentials");
  if (!device.approved) throw new AppError(423, "Device enrollment is not approved");
  if (device.blocked) throw new AppError(423, "Device is blocked");

  const challenge = context.store.challenges.get(payload.challengeDto.challengeId);
  if (
    !challenge ||
    challenge.purpose !== "login" ||
    challenge.deviceId !== device.id ||
    Date.parse(challenge.expiresAt) <= Date.now() ||
    !verifyNonce(challenge.nonce, payload.challengeDto.signature, device.publicIdentityKey)
  ) {
    throw new AppError(401, "Invalid device challenge");
  }
  context.store.challenges.delete(challenge.id);
  device.lastSeen = now();
  const access = context.store.issueToken("ACCESS_TOKEN", user.id, device.id);
  const refresh = context.store.issueRefreshToken(user.id, device.id);
  setRefreshCookie(context.response, refresh.token);
  return { body: { accessToken: access.token, accessTokenType: access.type } };
};

const authStatus: OperationHandler = (context) => ({
  body: { isAuthenticated: context.auth.session?.type === "ACCESS_TOKEN" && Boolean(context.auth.device) },
});

const authMe: OperationHandler = (context) => ({
  body: {
    userId: context.auth.user!.id,
    username: context.auth.user!.username,
    email: context.auth.user!.email,
    grantedAuthorities: context.auth.user!.grantedAuthorities,
  },
});

const authConfirmEmail: OperationHandler = () => ({ body: { message: "Email confirmed successfully" } });

const authRefresh: OperationHandler = (context) => {
  const token = context.request.cookies.refreshToken as string | undefined;
  if (!token) throw new AppError(400, "Missing request cookie: refreshToken");
  const refresh = context.store.refreshTokens.get(token);
  if (!refresh?.deviceId) throw new AppError(401, "Invalid refresh token");
  const device = context.store.state.devices.find((candidate) => candidate.id === refresh.deviceId);
  if (!device?.approved || device.blocked) throw new AppError(401, "Invalid refresh token");
  context.store.refreshTokens.delete(token);
  const access = context.store.issueToken("ACCESS_TOKEN", refresh.userId, refresh.deviceId);
  const rotated = context.store.issueRefreshToken(refresh.userId, refresh.deviceId);
  setRefreshCookie(context.response, rotated.token);
  return { body: { accessToken: access.token, accessTokenType: access.type } };
};

const authLogout: OperationHandler = (context) => {
  const token = context.request.cookies.refreshToken as string | undefined;
  if (!token) throw new AppError(400, "Missing request cookie: refreshToken");
  context.store.refreshTokens.delete(token);
  context.response.clearCookie("refreshToken", { path: "/" });
  return { body: { message: "User logged out successfully" } };
};

const deviceNonce: OperationHandler = (context) => {
  const targetId = context.request.params.deviceId;
  const device = context.store.state.devices.find((candidate) => candidate.id === targetId);
  if (!device) throw new AppError(404, "Device not found");
  if (!device.approved) {
    return { status: 202, body: { message: "Enrollment of this device is not accepted yet" } };
  }
  if (device.blocked) throw new AppError(423, "Device is blocked");
  const challenge = context.store.createChallenge(device, "login");
  return {
    body: { nonce: challenge.nonce, expiresAt: challenge.expiresAt, challengeId: challenge.id },
  };
};

const createEnrollment: OperationHandler = (context) =>
  idempotent(context, "device.createEnrollment", () => {
    const payload = body(context) as { userAgent: string; publicIdentityKey: PublicJwk };
    const createdDeviceId = randomUUID();
    const enrollmentId = randomUUID();
    const createdAt = now();
    const description = deviceDescription(payload.userAgent);
    const device: DeviceRecord = {
      id: createdDeviceId,
      userId: userId(context),
      publicIdentityKey: payload.publicIdentityKey,
      ...description,
      remoteAddr: context.request.ip ?? "127.0.0.1",
      lastSeen: null,
      blocked: false,
      approved: false,
    };
    context.store.state.devices.push(device);
    context.store.state.enrollments.push({
      id: enrollmentId,
      userId: device.userId,
      deviceId: device.id,
      publicIdentityKey: device.publicIdentityKey,
      userAgent: payload.userAgent,
      remoteAddr: device.remoteAddr,
      createdAt,
    });
    const challenge = context.store.createChallenge(device, "enrollment");
    return {
      body: {
        enrollmentId,
        challenge: { nonce: challenge.nonce, expiresAt: challenge.expiresAt, challengeId: challenge.id },
      },
    };
  });

const confirmEnrollment: OperationHandler = (context) =>
  idempotent(context, "device.confirmEnrollment", () => {
    const payload = body(context) as { enrollmentId: string; challengeId: string; signature: string };
    const enrollment = context.store.state.enrollments.find(
      (candidate) => candidate.id === payload.enrollmentId && candidate.userId === userId(context),
    );
    if (!enrollment) throw new AppError(404, "Enrollment not found");
    const device = requireValue(
      context.store.state.devices.find((candidate) => candidate.id === enrollment.deviceId),
      404,
      "Device not found",
    );
    const challenge = context.store.challenges.get(payload.challengeId);
    if (
      !challenge ||
      challenge.purpose !== "enrollment" ||
      challenge.deviceId !== device.id ||
      Date.parse(challenge.expiresAt) <= Date.now() ||
      !verifyNonce(challenge.nonce, payload.signature, device.publicIdentityKey)
    ) {
      throw new AppError(401, "Invalid enrollment challenge");
    }
    context.store.challenges.delete(challenge.id);
    if (context.store.settings.autoApproveEnrollments) {
      device.approved = true;
      device.lastSeen = now();
      context.store.state.enrollments = context.store.state.enrollments.filter(
        (candidate) => candidate.id !== enrollment.id,
      );
    }
    return { body: { deviceId: device.id } };
  });

const listEnrollments: OperationHandler = (context) => ({
  body: {
    enrollments: context.store.state.enrollments
      .filter((enrollment) => enrollment.userId === userId(context))
      .map((enrollment) => {
        const description = deviceDescription(enrollment.userAgent);
        return {
          id: enrollment.id,
          ...description,
          remoteAddr: enrollment.remoteAddr,
          createdAt: enrollment.createdAt,
        };
      }),
  },
});

const approveEnrollment: OperationHandler = (context) => {
  const enrollment = context.store.state.enrollments.find(
    (candidate) => candidate.id === context.request.params.enrollmentId && candidate.userId === userId(context),
  );
  if (!enrollment) throw new AppError(404, "Enrollment not found");
  const device = requireValue(
    context.store.state.devices.find((candidate) => candidate.id === enrollment.deviceId),
    404,
    "Device not found",
  );
  device.approved = true;
  device.lastSeen = now();
  context.store.state.enrollments = context.store.state.enrollments.filter(
    (candidate) => candidate.id !== enrollment.id,
  );
  return { body: { message: `Approved device for enrollment ${enrollment.id}` } };
};

const listDevices: OperationHandler = (context) => ({
  body: {
    devices: context.store.state.devices
      .filter((device) => device.userId === userId(context) && device.approved)
      .map((device) => ({
        id: device.id,
        lastOsName: device.lastOsName,
        deviceType: device.deviceType,
        lastSeen: device.lastSeen,
        blocked: device.blocked,
        current: device.id === deviceId(context),
      })),
  },
});

function changeBlocked(context: OperationContext, blocked: boolean): OperationResult {
  const targetId = body(context).targetDeviceId as string;
  if (targetId === deviceId(context)) throw new AppError(400, "Device cannot be blocked by itself");
  const target = context.store.state.devices.find(
    (candidate) => candidate.id === targetId && candidate.userId === userId(context) && candidate.approved,
  );
  if (!target) throw new AppError(404, "Device not found");
  target.blocked = blocked;
  return { body: { message: `Device ${blocked ? "blocked" : "unblocked"} successfully` } };
}

const deviceIdentity: OperationHandler = (context) => {
  const device = context.store.state.devices.find(
    (candidate) => candidate.id === context.request.params.deviceId && candidate.userId === userId(context),
  );
  if (!device) throw new AppError(404, "Device not found");
  return { body: device.publicIdentityKey };
};

const keySyncInit: OperationHandler = (context) => {
  const vaultId = body(context).vaultId as string;
  requireVault(context, vaultId);
  return { body: { code: context.keySync.createRoom(userId(context), deviceId(context), vaultId) } };
};

const vaultList: OperationHandler = (context) => ({
  body: context.store.state.vaults
    .filter((vault) => vault.userId === userId(context))
    .map((vault) => ({
      vaultId: vault.id,
      vaultName: vault.name,
      isOnline: vault.isOnline,
      passwordCount: context.store.state.passwords.filter((password) => password.vaultId === vault.id).length,
      lastSeenAt: vault.lastSeenAt,
    })),
});

const vaultCreate: OperationHandler = (context) => {
  const name = String(body(context).vaultName).trim();
  const vault: VaultRecord = {
    id: randomUUID(),
    userId: userId(context),
    name,
    isOnline: context.store.settings.newVaultsOnline,
    lastSeenAt: context.store.settings.newVaultsOnline ? now() : null,
    apiKey: randomBytes(32).toString("base64url"),
  };
  context.store.state.vaults.push(vault);
  return {
    body: { vaultId: vault.id, apiKey: vault.apiKey, message: "Vault created successfully" },
  };
};

const vaultUpdate: OperationHandler = (context) => {
  const vault = requireVault(context, param(context, "vaultId"));
  vault.name = String(body(context).vaultName).trim();
  return { body: { message: "Vault updated successfully" } };
};

const vaultDelete: OperationHandler = (context) => {
  const vault = requireVault(context, param(context, "vaultId"));
  context.store.state.vaults = context.store.state.vaults.filter((candidate) => candidate.id !== vault.id);
  context.store.state.passwords = context.store.state.passwords.filter((password) => password.vaultId !== vault.id);
  context.store.state.tags = context.store.state.tags.filter((tag) => tag.vaultId !== vault.id);
  return { body: { message: "Vault deleted successfully" } };
};

const passwordSave: OperationHandler = (context) => {
  const payload = body(context) as {
    identifier: string;
    address: string;
    cipherText: string;
    vaultId: string;
    passwordType: "PASSWORD" | "SSH_KEY";
  };
  requireVault(context, payload.vaultId, true);
  const password: PasswordRecord = {
    id: randomUUID(),
    userId: userId(context),
    vaultId: payload.vaultId,
    identifier: payload.identifier,
    address: payload.address,
    cipherText: payload.cipherText,
    passwordType: payload.passwordType,
    lastModified: now(),
    tagIds: [],
    note: null,
  };
  context.store.state.passwords.push(password);
  recordEvent(context, password, "ADDED");
  return { body: { message: "Password save request accepted" } };
};

const passwordUpdate: OperationHandler = (context) => {
  const payload = body(context) as {
    passwordId: string;
    identifier: string;
    address: string;
    cipherText: string;
    vaultId: string;
  };
  const password = requirePassword(context, payload.passwordId, payload.vaultId);
  password.identifier = payload.identifier;
  password.address = payload.address;
  password.cipherText = payload.cipherText;
  password.lastModified = now();
  recordEvent(context, password, "UPDATED");
  return { body: { message: "Password updated successfully" } };
};

const passwordDelete: OperationHandler = (context) => {
  const payload = body(context) as { passwordId: string; vaultId: string };
  const password = requirePassword(context, payload.passwordId, payload.vaultId);
  recordEvent(context, password, "REMOVED");
  context.store.state.passwords = context.store.state.passwords.filter(
    (candidate) => candidate.id !== password.id,
  );
  return { body: { message: "Password deleted successfully" } };
};

const passwordMetadata: OperationHandler = (context) => {
  const vaultId = String(context.request.query.vaultId);
  requireVault(context, vaultId, true);
  return {
    body: context.store.state.passwords
      .filter((password) => password.vaultId === vaultId && password.userId === userId(context))
      .map((password) => ({
        passwordId: password.id,
        identifier: password.identifier,
        address: password.address,
        lastModified: password.lastModified,
        hasNote: password.note !== null,
        passwordType: password.passwordType,
        tags: password.tagIds
          .map((tagId) => context.store.state.tags.find((tag) => tag.id === tagId))
          .filter((tag): tag is TagRecord => Boolean(tag))
          .map((tag) => ({ tagId: tag.id, tagName: tag.name, color: tag.color })),
      })),
  };
};

const passwordCiphertext: OperationHandler = (context) => {
  const vaultId = String(context.request.query.vaultId);
  const password = requirePassword(context, param(context, "passwordId"), vaultId);
  return {
    body: { ciphertext: password.cipherText, passwordId: password.id, type: "CIPHERTEXT_RETRIEVAL" },
  };
};

const tagList: OperationHandler = (context) => {
  const vault = requireVault(context, param(context, "vaultId"), true);
  return {
    body: context.store.state.tags
      .filter((tag) => tag.vaultId === vault.id && tag.userId === userId(context))
      .map((tag) => ({ tagId: tag.id, tagName: tag.name, color: tag.color })),
  };
};

const tagCreate: OperationHandler = (context) => {
  const payload = body(context) as { vaultId: string; tagName: string; color: string };
  requireVault(context, payload.vaultId, true);
  const tag: TagRecord = {
    id: randomUUID(),
    userId: userId(context),
    vaultId: payload.vaultId,
    name: payload.tagName,
    color: payload.color,
  };
  context.store.state.tags.push(tag);
  return {
    status: 201,
    headers: { Location: `/api/v1/passwords/vault/${tag.vaultId}/tags` },
  };
};

const tagUpdate: OperationHandler = (context) => {
  const tag = requireTag(context, param(context, "tagId"), param(context, "vaultId"));
  const payload = body(context) as { tagName?: string; color?: string };
  if (payload.tagName !== undefined) tag.name = payload.tagName;
  if (payload.color !== undefined) tag.color = payload.color;
  return {};
};

const tagDelete: OperationHandler = (context) => {
  const tag = requireTag(context, param(context, "tagId"), param(context, "vaultId"));
  context.store.state.tags = context.store.state.tags.filter((candidate) => candidate.id !== tag.id);
  for (const password of context.store.state.passwords) {
    password.tagIds = password.tagIds.filter((tagId) => tagId !== tag.id);
  }
  return {};
};

function changeTagAssignment(context: OperationContext, assigned: boolean): OperationResult {
  const payload = body(context) as { vaultId: string; tagId: string };
  const password = requirePassword(context, param(context, "passwordId"), payload.vaultId);
  requireTag(context, payload.tagId, payload.vaultId);
  if (assigned && !password.tagIds.includes(payload.tagId)) password.tagIds.push(payload.tagId);
  if (!assigned) password.tagIds = password.tagIds.filter((tagId) => tagId !== payload.tagId);
  return { status: 204 };
}

const noteGet: OperationHandler = (context) => {
  const password = requirePassword(
    context,
    param(context, "passwordId"),
    param(context, "vaultId"),
  );
  return { body: { content: password.note ?? "" } };
};

const noteSave: OperationHandler = (context) => {
  const password = requirePassword(
    context,
    param(context, "passwordId"),
    param(context, "vaultId"),
  );
  password.note = String(body(context).content);
  password.lastModified = now();
  return { status: 204 };
};

const statisticsDashboard: OperationHandler = (context) => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const events = context.store.state.events.filter((event) => event.userId === userId(context));
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.actionType !== "ADDED" || Date.parse(event.date) < cutoff) continue;
    const day = new Date(event.date);
    day.setUTCHours(0, 0, 0, 0);
    const key = day.toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    body: {
      passwordChart: [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, addedCount]) => ({ date, addedCount })),
      recentActions: [...events]
        .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
        .slice(0, 20)
        .map((event) => ({
          date: event.date,
          actionType: event.actionType,
          domain: event.domain,
          vaultId: event.vaultId,
        })),
    },
  };
};

export const operationHandlers: Record<string, OperationHandler> = {
  "auth.register": authRegister,
  "auth.login": authLogin,
  "auth.status": authStatus,
  "auth.me": authMe,
  "auth.confirmEmail": authConfirmEmail,
  "auth.refresh": authRefresh,
  "auth.logout": authLogout,
  "device.nonce": deviceNonce,
  "device.createEnrollment": createEnrollment,
  "device.confirmEnrollment": confirmEnrollment,
  "device.enrollments": listEnrollments,
  "device.approveEnrollment": approveEnrollment,
  "device.devices": listDevices,
  "device.block": (context) => changeBlocked(context, true),
  "device.unblock": (context) => changeBlocked(context, false),
  "device.identity": deviceIdentity,
  "keySync.init": keySyncInit,
  "vault.list": vaultList,
  "vault.create": vaultCreate,
  "vault.update": vaultUpdate,
  "vault.delete": vaultDelete,
  "password.save": passwordSave,
  "password.update": passwordUpdate,
  "password.delete": passwordDelete,
  "password.metadata": passwordMetadata,
  "password.ciphertext": passwordCiphertext,
  "tag.list": tagList,
  "tag.create": tagCreate,
  "tag.update": tagUpdate,
  "tag.delete": tagDelete,
  "tag.assign": (context) => changeTagAssignment(context, true),
  "tag.unassign": (context) => changeTagAssignment(context, false),
  "note.get": noteGet,
  "note.save": noteSave,
  "statistics.dashboard": statisticsDashboard,
};
