import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import type { FormatsPlugin } from "ajv-formats";
import type {
  ContractBundle,
  RouteContract,
  ScenarioSettings,
  ScenarioState,
} from "./types.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const addFormats = require("ajv-formats") as FormatsPlugin;

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read JSON file ${filePath}: ${message}`);
  }
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

function assertRoutes(value: unknown): asserts value is RouteContract[] {
  if (!Array.isArray(value)) throw new Error("contracts/routes.json must contain an array");

  const ids = new Set<string>();
  for (const route of value) {
    if (!route || typeof route !== "object") throw new Error("Every route contract must be an object");
    const candidate = route as Partial<RouteContract>;
    if (!candidate.id || !candidate.method || !candidate.path || !candidate.auth) {
      throw new Error(`Invalid route contract: ${JSON.stringify(route)}`);
    }
    if (ids.has(candidate.id)) throw new Error(`Duplicate route operation id: ${candidate.id}`);
    ids.add(candidate.id);
  }
}

function createValidators(schemaDocument: unknown): Map<string, ValidateFunction> {
  if (!schemaDocument || typeof schemaDocument !== "object" || Array.isArray(schemaDocument)) {
    throw new Error("contracts/schemas.json must contain an object keyed by schema name");
  }

  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);

  const entries = Object.entries(schemaDocument as Record<string, object>);
  for (const [name, schema] of entries) ajv.addSchema({ ...schema, $id: name }, name);

  const validators = new Map<string, ValidateFunction>();
  for (const [name] of entries) {
    const validator = ajv.getSchema(name);
    if (!validator) throw new Error(`Unable to compile JSON schema ${name}`);
    validators.set(name, validator);
  }
  return validators;
}

function validateNamed(
  validators: Map<string, ValidateFunction>,
  schemaName: string,
  value: unknown,
  source: string,
): void {
  const validator = validators.get(schemaName);
  if (!validator) throw new Error(`${source} references unknown schema ${schemaName}`);
  if (!validator(value)) throw new Error(`${source} failed ${schemaName}: ${formatErrors(validator.errors)}`);
}

function validateRelationships(state: ScenarioState, source: string): void {
  const userIds = new Set(state.users.map((user) => user.id));
  const deviceIds = new Set<string>();
  const vaultIds = new Set<string>();
  const passwordIds = new Set<string>();
  const tagIds = new Set<string>();

  for (const device of state.devices) {
    if (deviceIds.has(device.id)) throw new Error(`${source}: duplicate device id ${device.id}`);
    if (!userIds.has(device.userId)) throw new Error(`${source}: device ${device.id} has an unknown user`);
    deviceIds.add(device.id);
  }
  for (const enrollment of state.enrollments) {
    if (!userIds.has(enrollment.userId)) throw new Error(`${source}: enrollment ${enrollment.id} has an unknown user`);
  }
  for (const vault of state.vaults) {
    if (vaultIds.has(vault.id)) throw new Error(`${source}: duplicate vault id ${vault.id}`);
    if (!userIds.has(vault.userId)) throw new Error(`${source}: vault ${vault.id} has an unknown user`);
    vaultIds.add(vault.id);
  }
  for (const tag of state.tags) {
    if (tagIds.has(tag.id)) throw new Error(`${source}: duplicate tag id ${tag.id}`);
    if (!vaultIds.has(tag.vaultId) || !userIds.has(tag.userId)) {
      throw new Error(`${source}: tag ${tag.id} has a broken relationship`);
    }
    tagIds.add(tag.id);
  }
  for (const password of state.passwords) {
    if (passwordIds.has(password.id)) throw new Error(`${source}: duplicate password id ${password.id}`);
    if (!vaultIds.has(password.vaultId) || !userIds.has(password.userId)) {
      throw new Error(`${source}: password ${password.id} has a broken relationship`);
    }
    for (const tagId of password.tagIds) {
      if (!tagIds.has(tagId)) throw new Error(`${source}: password ${password.id} references unknown tag ${tagId}`);
    }
    passwordIds.add(password.id);
  }
  for (const event of state.events) {
    if (!userIds.has(event.userId) || !vaultIds.has(event.vaultId)) {
      throw new Error(`${source}: event ${event.id} has a broken relationship`);
    }
  }
}

function validateRouteSchemas(routes: RouteContract[], validators: Map<string, ValidateFunction>): void {
  for (const route of routes) {
    for (const schemaName of Object.values(route.request)) {
      if (!validators.has(schemaName)) throw new Error(`${route.id} references unknown request schema ${schemaName}`);
    }
    for (const schemaName of Object.values(route.responses)) {
      if (schemaName && !validators.has(schemaName)) {
        throw new Error(`${route.id} references unknown response schema ${schemaName}`);
      }
    }
  }
}

export function loadContracts(options: { scenario?: string; rootDir?: string } = {}): ContractBundle {
  const rootDir = options.rootDir ?? projectRoot;
  const scenarioName = options.scenario ?? process.env.MOCK_SCENARIO ?? "default";
  if (!/^[a-z0-9-]+$/.test(scenarioName)) throw new Error(`Invalid mock scenario name: ${scenarioName}`);

  const contractsDir = path.join(rootDir, "contracts");
  const scenarioDir = path.join(rootDir, "scenarios", scenarioName);
  const routesValue = readJson(path.join(contractsDir, "routes.json"));
  assertRoutes(routesValue);
  const validators = createValidators(readJson(path.join(contractsDir, "schemas.json")));
  validateRouteSchemas(routesValue, validators);

  const state = readJson(path.join(scenarioDir, "state.json")) as ScenarioState;
  const settings = readJson(path.join(scenarioDir, "settings.json")) as ScenarioSettings;
  validateNamed(validators, "scenarioState", state, `${scenarioName}/state.json`);
  validateNamed(validators, "scenarioSettings", settings, `${scenarioName}/settings.json`);
  validateRelationships(state, `${scenarioName}/state.json`);

  const routesById = new Map(routesValue.map((route) => [route.id, route]));
  for (const [operationId, override] of Object.entries(settings.overrides)) {
    const route = routesById.get(operationId);
    if (!route) throw new Error(`${scenarioName}/settings.json overrides unknown operation ${operationId}`);
    const responseSchema = route.responses[String(override.status)] ?? route.responses.default;
    if (responseSchema) {
      validateNamed(validators, responseSchema, override.body, `${scenarioName} override ${operationId}`);
    } else if (override.body !== undefined) {
      throw new Error(`${scenarioName} override ${operationId} supplies a body for an empty response`);
    }
  }

  return {
    routes: routesValue,
    validators,
    settings: structuredClone(settings),
    state: structuredClone(state),
    scenarioName,
  };
}

export function describeValidationErrors(validator: ValidateFunction): { field: string; message: string }[] {
  return (validator.errors ?? []).map((error) => ({
    field: error.instancePath.replace(/^\//, "").replaceAll("/", ".") || "request",
    message: error.message ?? "Invalid value",
  }));
}
