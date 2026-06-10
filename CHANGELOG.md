# Changelog

## 2026.6.3

### Changed

- Packaging only, no functional changes. Republished with the compiled `dist/` build (declared via `openclaw.runtimeExtensions`) and without test files in the tarball. The `2026.6.2` npm release predated the build setup and shipped raw TypeScript sources; `2026.6.3` is the clean, compiled artifact published consistently to npm and ClawHub.

## 2026.6.2

### Fixed

- **Install was broken for everyone:** `@pspdfkit/pdf-to-markdown` was pinned to `1.0.0`, a version that was never published (npm only has up to `0.2.2`). Pinned to `0.2.2` so the plugin installs.
- **Missing dependency:** `@sinclair/typebox` was imported but not declared, breaking standalone `npm install --omit=dev`. Now declared (`0.34.49`, matching the host).
- **Availability detection:** `nutrient-pdf status` and the startup check no longer report the CLI as "available" when the binary exists but cannot actually run (permission errors, timeouts, kills). Only a real successful spawn counts.
- **Command resolution:** extraction now uses the same local-bin → PATH fallback as the availability check, so it can no longer fail with "not found" for a command the status check accepted (notably under hoisted/pnpm installs).
- **Output buffer:** raised the stdout buffer to 64 MB to cover the 50 MB input cap (markdown can be larger than the source PDF), with a clear "output too large" message on overflow.
- **CLI errors:** `openclaw nutrient-pdf extract` now reports failures cleanly and exits non-zero instead of throwing an unhandled rejection.
- Empty extraction output accompanied by a CLI diagnostic is now surfaced as an error instead of a silent blank result.
- Removed a dead import and de-duplicated the install-hint message across the tool, status, and extract paths.

### Changed

- **Repositioned for OpenClaw 2026.6.** OpenClaw 2026.6 moved PDF extraction into the bundled `document-extract` plugin (the `clawpdf` engine) and removed the `agents.defaults.pdfExtraction.*` configuration. The built-in `pdf` tool can no longer be routed through an external extractor, so this plugin is now positioned purely as an explicit `nutrient_pdf_extract` tool and `openclaw nutrient-pdf` CLI. README and startup logging updated to match.
- **Removed dead configuration references.** The startup check that read `agents.defaults.pdfExtraction.engine` and the README guidance to set it were dropped — that key no longer exists in OpenClaw 2026.6.
- Updated `openclaw.build` metadata to `2026.6.2` and added the required `pluginSdkVersion` for ClawHub. Compatibility floor stays at `2026.4.1` (the plugin still runs there — the SDK is backward compatible).

### Added

- A `vitest` test suite covering CLI availability detection, command resolution, and PDF path validation.
- Compiled `dist/` output (a `tsc` build, run on `prepack`) declared via `openclaw.runtimeExtensions`, so the plugin loads as a packaged install through native import and satisfies ClawHub's compiled-output publish requirement.

## 2026.4.16

### Added

- Required ClawHub metadata: `openclaw.build.openclawVersion` and `openclaw.compat.minGatewayVersion`. Enables publishing to the ClawHub plugin registry.

## 2026.4.15

First stable release.

### Fixed

- Install command in README: `openclaw plugin` → `openclaw plugins` (plural).

### Changed

- Expanded npm keywords for better discoverability (`pdfjs-alternative`, `pdf-table-extraction`, `ai-pdf`, etc.).

### What's included

- `nutrient_pdf_extract` tool for agents to explicitly request Nutrient extraction.
- `openclaw nutrient-pdf extract <file.pdf>` CLI command for direct extraction.
- Automatic integration with OpenClaw's built-in `pdf` tool when `engine` is set to `auto`.
- Local processing only — no cloud uploads, no API keys required.
- Graceful fallback to pdfjs if the Nutrient CLI is unavailable.
- Configurable CLI path and extraction timeout.

### Benchmark (200 documents)

| Metric           | pdfjs | Nutrient | Change |
|------------------|-------|----------|--------|
| Overall accuracy | 0.578 | 0.880    | +52%   |
| Table structure  | 0.000 | 0.662    | —      |
| Heading fidelity | 0.000 | 0.811    | —      |
| Reading order    | 0.871 | 0.924    | +6%    |
