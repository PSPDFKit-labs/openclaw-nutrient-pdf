/**
 * Nutrient pdf-to-markdown CLI wrapper.
 * Handles binary discovery, availability checking, and PDF extraction.
 */

import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const DEFAULT_TIMEOUT_MS = 30_000;
// Markdown output can exceed the source PDF size (tables expand verbiage), so the
// stdout buffer must comfortably cover the 50 MB input cap below.
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const BARE_COMMAND = "pdf-to-markdown";

export type NutrientCliConfig = {
  command?: string;
  timeoutMs?: number;
};

export type NutrientExtractionResult = {
  markdown: string;
  durationMs: number;
  stderrSnippet?: string;
};

/**
 * Resolve the plugin-local `node_modules/.bin/pdf-to-markdown` path, if it can be
 * computed. Returns null when `import.meta.url` is unavailable.
 */
function resolveLocalBin(): string | null {
  try {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    // From src/nutrient-cli.ts, go up to plugin root, then into node_modules/.bin
    return path.resolve(thisDir, "..", "node_modules", ".bin", BARE_COMMAND);
  } catch {
    return null;
  }
}

/**
 * The ordered list of commands to try.
 * - An explicit configured command is authoritative (used alone).
 * - Otherwise probe the plugin-local bin first, then fall back to PATH. Under
 *   hoisted/pnpm installs the local bin may not exist, so PATH is the safety net.
 *
 * Both availability checks and extraction resolve through this single helper so
 * they can never disagree about which binary to run.
 */
function resolveCandidates(configured?: string): string[] {
  if (configured) {
    return [configured];
  }
  const local = resolveLocalBin();
  return local ? [local, BARE_COMMAND] : [BARE_COMMAND];
}

/**
 * Distinguish "the process actually ran and exited non-zero" from "the process
 * could not be spawned" (ENOENT/EACCES) or was killed (timeout/signal).
 *
 * A binary that ran — even if it errored on `--version` — is genuinely present
 * and runnable, so it counts as available. A spawn failure or a kill does not.
 */
function ranButFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const e = error as { code?: unknown; killed?: boolean; signal?: unknown };
  if (e.killed === true || e.signal) {
    return false; // timed out or killed -> not usable
  }
  // execFile sets a numeric `code` to the child's exit status when it actually ran.
  // String codes (ENOENT, EACCES, ...) mean the spawn itself failed.
  return typeof e.code === "number";
}

function isEnoent(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT",
  );
}

function isMaxBufferError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return true;
  }
  return typeof e.message === "string" && /maxBuffer/i.test(e.message);
}

/**
 * Check whether the Nutrient CLI binary is available.
 *
 * Returns true only when a candidate command genuinely runs (spawns and exits, or
 * exits non-zero on `--version`). Spawn failures (ENOENT/EACCES), timeouts, and
 * kills are never reported as available.
 */
export async function isNutrientCliAvailable(command?: string): Promise<boolean> {
  for (const cmd of resolveCandidates(command)) {
    try {
      await execFile(cmd, ["--version"], { timeout: 10_000 });
      return true;
    } catch (error) {
      if (ranButFailed(error)) {
        return true; // binary exists and runs, just errored on --version
      }
      // spawn failure / timeout / kill -> try the next candidate
    }
  }
  return false;
}

/**
 * Get the version string from the Nutrient CLI.
 */
export async function getNutrientCliVersion(command?: string): Promise<string | null> {
  for (const cmd of resolveCandidates(command)) {
    try {
      const { stdout } = await execFile(cmd, ["--version"], { timeout: 10_000, encoding: "utf8" });
      return stdout.trim() || null;
    } catch (error) {
      if (ranButFailed(error)) {
        return null; // ran but produced no usable version string
      }
      // spawn failure -> try the next candidate
    }
  }
  return null;
}

/**
 * Validate a PDF file path before reading.
 * Enforces .pdf extension and size cap.
 */
export async function validatePdfPath(
  pdfPath: string,
): Promise<{ resolvedPath: string; buffer: Buffer }> {
  const resolved = path.resolve(pdfPath);

  // Enforce .pdf extension
  if (!resolved.toLowerCase().endsWith(".pdf")) {
    throw new Error(`File must have .pdf extension: ${resolved}`);
  }

  const buffer = await readFile(resolved);

  // Enforce size cap
  if (buffer.length > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `PDF exceeds maximum size: ${(buffer.length / 1024 / 1024).toFixed(1)}MB > ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB`,
    );
  }

  return { resolvedPath: resolved, buffer };
}

/**
 * Extract markdown from a PDF buffer using the Nutrient CLI.
 *
 * Tries each resolved candidate in order, falling through ENOENT to the next so
 * extraction never fails with "not found" for a command the availability check
 * accepted via its PATH fallback.
 */
export async function extractWithNutrientCli(
  buffer: Buffer,
  config?: NutrientCliConfig,
): Promise<NutrientExtractionResult> {
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const candidates = resolveCandidates(config?.command);

  const startedAt = Date.now();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-nutrient-pdf-"));
  const inputPath = path.join(tmpDir, "input.pdf");

  try {
    await writeFile(inputPath, buffer);

    let lastSpawnError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      const command = candidates[i];
      const isLastCandidate = i === candidates.length - 1;
      try {
        const { stdout, stderr } = await execFile(command, [inputPath], {
          timeout: timeoutMs,
          maxBuffer: MAX_BUFFER_BYTES,
          encoding: "utf8",
        });
        const durationMs = Date.now() - startedAt;
        const stderrTrimmed = typeof stderr === "string" ? stderr.trim() : "";
        const markdown = stdout.trim();
        // Empty output with a diagnostic is a failure, not a successful blank doc.
        if (!markdown && stderrTrimmed) {
          throw new Error(`Nutrient produced no output: ${stderrTrimmed.slice(0, 300)}`);
        }
        return {
          markdown,
          durationMs,
          stderrSnippet: stderrTrimmed ? stderrTrimmed.slice(0, 300) : undefined,
        };
      } catch (error) {
        if (isEnoent(error) && !isLastCandidate) {
          lastSpawnError = error; // binary not at this path -> try next candidate
          continue;
        }
        if (isMaxBufferError(error)) {
          throw new Error(
            `Nutrient output exceeded the ${MAX_BUFFER_BYTES / 1024 / 1024}MB buffer limit.`,
          );
        }
        throw error;
      }
    }
    throw lastSpawnError ?? new Error(`Nutrient CLI not found: ${BARE_COMMAND}`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
