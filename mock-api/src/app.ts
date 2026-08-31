import { createServer, type Server } from "node:http";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { describeValidationErrors, loadContracts } from "./contracts.js";
import { AppError } from "./errors.js";
import { KeySyncServer } from "./key-sync.js";
import { operationHandlers } from "./operations.js";
import { RuntimeStore } from "./store.js";
import type {
  AuthContext,
  AuthMode,
  ContractBundle,
  OperationOverride,
  OperationResult,
  RouteContract,
} from "./types.js";

export type MockRuntime = {
  app: express.Express;
  contracts: ContractBundle;
  store: RuntimeStore;
  keySync: KeySyncServer;
  createHttpServer(): Server;
};

function bearerToken(request: Request): string | null {
  const authorization = request.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}

function authenticate(request: Request, mode: AuthMode, store: RuntimeStore): AuthContext {
  if (mode === "public") return { session: null, user: null, device: null };
  const token = bearerToken(request);
  const session = token ? store.accessTokens.get(token) ?? null : null;
  const user = session ? store.state.users.find((candidate) => candidate.id === session.userId) ?? null : null;
  const device = session?.deviceId
    ? store.state.devices.find((candidate) => candidate.id === session.deviceId) ?? null
    : null;

  if (mode === "optional") {
    if (session?.type !== "ACCESS_TOKEN" || !user || !device?.approved || device.blocked) {
      return { session: null, user: null, device: null };
    }
    return { session, user, device };
  }
  if (!session || !user) throw new AppError(401, "Unauthorized");
  if (mode === "enrollment") {
    if (session.type !== "DEVICE_ENROLLMENT_TOKEN") throw new AppError(401, "Unauthorized");
    return { session, user, device: null };
  }
  if (session.type !== "ACCESS_TOKEN" || !device?.approved || device.blocked) {
    throw new AppError(401, "Unauthorized");
  }
  return { session, user, device };
}

function requestPart(request: Request, part: keyof RouteContract["request"], validator: { schema?: unknown }): unknown {
  if (part === "body") return request.body;
  if (part === "params") return { ...request.params };
  if (part === "query") return { ...request.query };

  const properties = (validator.schema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
  return Object.fromEntries(Object.keys(properties).map((name) => [name, request.get(name)]));
}

function validateRequest(request: Request, route: RouteContract, contracts: ContractBundle): void {
  const errors: { field: string; message: string }[] = [];
  for (const [part, schemaName] of Object.entries(route.request) as [
    keyof RouteContract["request"],
    string,
  ][]) {
    const validator = contracts.validators.get(schemaName);
    if (!validator) throw new AppError(500, `Missing request validator ${schemaName}`);
    const value = requestPart(request, part, validator);
    if (!validator(value)) {
      errors.push(
        ...describeValidationErrors(validator).map((error) => ({
          field: error.field === "request" ? part : `${part}.${error.field}`,
          message: error.message,
        })),
      );
    }
  }
  if (errors.length > 0) throw new AppError(400, "Request validation failed", { errors });
}

function validateResponse(route: RouteContract, result: OperationResult, contracts: ContractBundle): void {
  const status = result.status ?? 200;
  const statusKey = String(status);
  const schemaName = Object.hasOwn(route.responses, statusKey)
    ? route.responses[statusKey]
    : route.responses.default;
  if (schemaName === null) {
    if (result.body !== undefined) throw new Error(`${route.id} returned a body for empty status ${status}`);
    return;
  }
  if (!schemaName) throw new Error(`${route.id} has no response schema for status ${status}`);
  const validator = contracts.validators.get(schemaName);
  if (!validator || !validator(result.body)) {
    const details = validator ? describeValidationErrors(validator) : [{ field: "response", message: "schema is missing" }];
    throw new Error(`${route.id} produced an invalid ${status} response: ${JSON.stringify(details)}`);
  }
}

async function applyOverride(response: Response, override: OperationOverride): Promise<void> {
  if (override.delayMs) await new Promise((resolve) => setTimeout(resolve, override.delayMs));
  if (override.headers) response.set(override.headers);
}

function sendResult(response: Response, result: OperationResult): void {
  const status = result.status ?? 200;
  if (result.headers) response.set(result.headers);
  if (status === 204 || result.body === undefined) {
    response.status(status).end();
    return;
  }
  response.status(status).json(result.body);
}

export function createMockRuntime(options: { scenario?: string; rootDir?: string } = {}): MockRuntime {
  const contracts = loadContracts(options);
  const store = new RuntimeStore(contracts.state, contracts.settings);
  const keySync = new KeySyncServer(store, contracts);
  const app = express();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const origin = request.get("origin");
    if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      response.set({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      });
    }
    if (request.method === "OPTIONS") {
      response.set({
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      });
      response.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json());
  app.use(cookieParser());
  app.get("/health", (_request, response) => {
    response.json({ status: "ok", scenario: contracts.scenarioName });
  });

  for (const route of contracts.routes) {
    const handler = operationHandlers[route.id];
    if (!handler) throw new Error(`No TypeScript operation handler is registered for ${route.id}`);
    app[route.method](route.path, async (request, response, next) => {
      try {
        validateRequest(request, route, contracts);
        const auth = authenticate(request, route.auth, store);
        const override = store.settings.overrides[route.id];
        let result: OperationResult;
        if (override) {
          await applyOverride(response, override);
          result = { status: override.status, headers: override.headers, body: override.body };
        } else {
          result = await handler({ request, response, auth, store, keySync });
        }
        validateResponse(route, result, contracts);
        sendResult(response, result);
      } catch (error) {
        next(error);
      }
    });
  }

  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found" });
  });
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ message: "Invalid JSON payload" });
      return;
    }
    if (error instanceof AppError) {
      response.status(error.status).json(error.body);
      return;
    }
    console.error("Unhandled mock API error", error);
    response.status(500).json({ message: "Internal server error occurred, please try again later" });
  });

  return {
    app,
    contracts,
    store,
    keySync,
    createHttpServer() {
      const server = createServer(app);
      keySync.attach(server);
      return server;
    },
  };
}
