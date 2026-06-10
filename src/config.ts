/**
 * Pure config readers for the nutrient-pdf plugin.
 *
 * Intentionally free of any `openclaw/plugin-sdk` imports so these helpers can be
 * unit-tested without the host runtime.
 */

export type PluginConfig = {
  command?: string;
  timeoutMs?: number;
};

/**
 * Coerce the plugin's own config block (`plugins.entries.nutrient-pdf.config`)
 * into a typed shape, ignoring values of the wrong type.
 */
export function coercePluginConfig(raw: unknown): PluginConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const record = raw as Record<string, unknown>;
  return {
    command: typeof record.command === "string" ? record.command : undefined,
    timeoutMs: typeof record.timeoutMs === "number" ? record.timeoutMs : undefined,
  };
}
