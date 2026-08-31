import { describe, expect, it } from "vitest";
import { loadContracts } from "../src/contracts.js";
import { operationHandlers } from "../src/operations.js";

describe("JSON contracts and scenarios", () => {
  for (const scenario of [
    "default",
    "empty",
    "offline-vault",
    "pending-enrollment",
    "dashboard-error",
  ]) {
    it(`loads and validates ${scenario}`, () => {
      const bundle = loadContracts({ scenario });
      expect(bundle.routes.length).toBeGreaterThan(30);
      expect(bundle.scenarioName).toBe(scenario);
    });
  }

  it("has exactly one behavior handler for every declared operation", () => {
    const declared = loadContracts().routes.map((route) => route.id).sort();
    expect(Object.keys(operationHandlers).sort()).toEqual(declared);
  });
});
