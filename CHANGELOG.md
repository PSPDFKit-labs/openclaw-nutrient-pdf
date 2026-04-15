# Changelog

## 2026.4.5

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
