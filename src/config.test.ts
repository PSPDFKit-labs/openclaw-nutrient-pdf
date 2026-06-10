import { describe, expect, it } from "vitest";
import { coercePluginConfig } from "./config.js";

describe("coercePluginConfig", () => {
  it("returns empty config for non-object input", () => {
    expect(coercePluginConfig(undefined)).toEqual({});
    expect(coercePluginConfig(null)).toEqual({});
    expect(coercePluginConfig("nope")).toEqual({});
  });

  it("ignores values of the wrong type", () => {
    expect(coercePluginConfig({ command: 123, timeoutMs: "soon" })).toEqual({
      command: undefined,
      timeoutMs: undefined,
    });
  });

  it("passes through well-typed values", () => {
    expect(coercePluginConfig({ command: "pdf-to-markdown", timeoutMs: 5000 })).toEqual({
      command: "pdf-to-markdown",
      timeoutMs: 5000,
    });
  });
});
