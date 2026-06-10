import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  extractWithNutrientCli,
  getNutrientCliVersion,
  isNutrientCliAvailable,
  validatePdfPath,
} from "./nutrient-cli.js";

const isPosix = process.platform !== "win32";
const execFileAsync = promisify(execFile);

let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "nutrient-cli-test-"));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Write a POSIX shell script and mark it executable. Returns its path. */
async function writeScript(name: string, body: string): Promise<string> {
  const p = path.join(tmp, name);
  await writeFile(p, `#!/bin/sh\n${body}\n`);
  await chmod(p, 0o755);
  return p;
}

describe("validatePdfPath", () => {
  it("rejects a path without a .pdf extension", async () => {
    await expect(validatePdfPath(path.join(tmp, "notes.txt"))).rejects.toThrow(/\.pdf extension/);
  });

  it("rejects a file over the 50MB size cap", async () => {
    const big = path.join(tmp, "big.pdf");
    await writeFile(big, ""); // truncate() requires the file to exist first
    await truncate(big, 50 * 1024 * 1024 + 1); // grow to a sparse file, fast
    await expect(validatePdfPath(big)).rejects.toThrow(/exceeds maximum size/);
  });

  it("returns a buffer for a valid small .pdf", async () => {
    const ok = path.join(tmp, "ok.pdf");
    await writeFile(ok, "%PDF-1.4 minimal");
    const { buffer, resolvedPath } = await validatePdfPath(ok);
    expect(buffer.length).toBeGreaterThan(0);
    expect(resolvedPath).toBe(ok);
  });
});

describe("isNutrientCliAvailable", () => {
  it("returns false when the command does not exist", async () => {
    expect(await isNutrientCliAvailable(path.join(tmp, "does-not-exist-xyz"))).toBe(false);
  });

  it("returns true when the command spawns and exits 0", async () => {
    // node --version exits 0
    expect(await isNutrientCliAvailable(process.execPath)).toBe(true);
  });

  it.runIf(isPosix)("returns false when the command exists but is not executable (EACCES)", async () => {
    const notExec = path.join(tmp, "not-exec");
    await writeFile(notExec, "plain text, no +x");
    await chmod(notExec, 0o644);
    expect(await isNutrientCliAvailable(notExec)).toBe(false);
  });

  it.runIf(isPosix)("returns true when the binary runs but exits non-zero on --version", async () => {
    const script = await writeScript("exits-nonzero.sh", "exit 3");
    expect(await isNutrientCliAvailable(script)).toBe(true);
  });
});

describe("getNutrientCliVersion", () => {
  it("returns a version string when the command supports --version", async () => {
    const version = await getNutrientCliVersion(process.execPath);
    expect(version).toMatch(/^v?\d+\./);
  });

  it("returns null when the command does not exist", async () => {
    expect(await getNutrientCliVersion(path.join(tmp, "nope-xyz"))).toBeNull();
  });
});

describe("extractWithNutrientCli", () => {
  it.runIf(isPosix)("returns trimmed markdown from the CLI stdout", async () => {
    const script = await writeScript("emit.sh", 'echo "# Hello"');
    const result = await extractWithNutrientCli(Buffer.from("%PDF"), { command: script });
    expect(result.markdown).toBe("# Hello");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it.runIf(isPosix)("throws when output is empty but stderr has a diagnostic", async () => {
    const script = await writeScript("warn.sh", 'echo "bad input" >&2');
    await expect(
      extractWithNutrientCli(Buffer.from("%PDF"), { command: script }),
    ).rejects.toThrow(/produced no output: bad input/);
  });

  it("cleans up its temp directory on success", async () => {
    // Sanity: a successful extraction with a real exit-0 command leaves no temp dir.
    // Use a command that ignores the input path and exits 0 with stdout.
    if (!isPosix) {
      return;
    }
    const before = await execFileAsync("sh", ["-c", `ls -d ${os.tmpdir()}/openclaw-nutrient-pdf-* 2>/dev/null | wc -l`]);
    const script = await writeScript("emit2.sh", 'echo "ok"');
    await extractWithNutrientCli(Buffer.from("%PDF"), { command: script });
    const after = await execFileAsync("sh", ["-c", `ls -d ${os.tmpdir()}/openclaw-nutrient-pdf-* 2>/dev/null | wc -l`]);
    expect(Number(after.stdout.trim())).toBeLessThanOrEqual(Number(before.stdout.trim()));
  });
});
