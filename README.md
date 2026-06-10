# Nutrient PDF Plugin for OpenClaw

Explicit, on-demand Nutrient PDF extraction for OpenClaw — structured Markdown output with tables, headings, and reading order preserved.

![Table comparison: pdfjs word soup vs Nutrient structured markdown](assets/table-comparison.png)

## What this plugin does

It adds an explicit Nutrient extraction surface you can call on demand:

- `nutrient_pdf_extract` — an agent tool to extract a specific PDF to structured Markdown
- `openclaw nutrient-pdf extract <file.pdf>` — a CLI command for direct extraction from your terminal
- `openclaw nutrient-pdf status` — check CLI availability and version

Use it when you want Nutrient's table and heading fidelity on a particular document, requested explicitly by the agent or from the command line.

## What it does not do

It does **not** change OpenClaw's built-in `pdf` tool. As of OpenClaw 2026.6, the built-in tool does its own extraction through the bundled `document-extract` plugin (the `clawpdf` engine), and OpenClaw does not currently expose a hook for an external plugin to substitute its own extractor there. So this plugin is a supplement for explicit extraction, not a drop-in replacement for the default engine.

> Note for users on OpenClaw 2026.4 – 2026.5: earlier versions had an `agents.defaults.pdfExtraction.engine` setting that routed the built-in tool through Nutrient. That configuration was removed in 2026.6 when extraction moved into the bundled `document-extract` plugin. This plugin no longer references it.

## Why Nutrient

Plain-text PDF extractors produce word soup: they score **0.000** on table structure and **0.000** on heading preservation across 200 real documents (measured against the historical pdfjs default).

When an agent asks "what's in row 3, column 4?" it needs structure, not a flat text dump. Nutrient produces Markdown with proper table rows and columns that agents can look up directly.

![Benchmark scores: pdfjs vs Nutrient across 200 documents](assets/benchmark-scores.png)

## Benchmark (200 documents, opendataloader-bench)

| Metric            | pdfjs   | Nutrient | Change  |
|-------------------|---------|----------|---------|
| Overall accuracy  | 0.578   | 0.880    | **+52%**|
| Table structure   | 0.000   | 0.662    | --      |
| Heading fidelity  | 0.000   | 0.811    | --      |
| Reading order     | 0.871   | 0.924    | +6%     |

Scored with NID (reading order), TEDS (table structure), and MHS (heading fidelity), versus the historical pdfjs default extractor.

## Install

```bash
openclaw plugins install @nutrient-sdk/openclaw-nutrient-pdf
```

Verify the bundled `pdf-to-markdown` CLI is reachable:

```bash
openclaw nutrient-pdf status
```

Then use the tool from an agent, or extract directly:

```bash
openclaw nutrient-pdf extract ./report.pdf
```

## Configuration

Optional settings under `plugins.entries.nutrient-pdf.config`. These affect only this plugin's tool and CLI:

```json5
{
  plugins: {
    entries: {
      "nutrient-pdf": {
        config: {
          command: "pdf-to-markdown",  // path to the CLI binary (auto-resolves by default)
          timeoutMs: 30000,            // extraction timeout per document
        }
      }
    }
  }
}
```

All processing runs locally. No cloud uploads, no API keys.

## Free tier

The `pdf-to-markdown` CLI includes 1,000 free documents per month. See [nutrient.io](https://nutrient.io) for higher-volume licensing.

## Links

- [GitHub](https://github.com/PSPDFKit-labs/openclaw-nutrient-pdf)
- [Nutrient pdf-to-markdown](https://github.com/pspdfkit/pdf-to-markdown)

## License

MIT -- see [LICENSE](LICENSE) for details and third-party dependency notice.
