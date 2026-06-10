/**
 * OpenClaw Nutrient PDF Plugin
 *
 * Provides explicit, on-demand Nutrient-powered PDF extraction:
 *   - the `nutrient_pdf_extract` agent tool, and
 *   - the `openclaw nutrient-pdf` CLI.
 *
 * Note: OpenClaw's built-in `pdf` tool performs its own extraction via the
 * bundled `document-extract` plugin (the `clawpdf` engine). OpenClaw does not
 * currently expose a hook for an external plugin to replace that built-in
 * extractor, so this plugin is an explicit-invocation supplement rather than a
 * drop-in engine for the built-in tool.
 */

import { Type } from "@sinclair/typebox";
import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { coercePluginConfig } from "./src/config.js";
import {
  DEFAULT_TIMEOUT_MS,
  extractWithNutrientCli,
  getNutrientCliVersion,
  isNutrientCliAvailable,
  validatePdfPath,
  type NutrientCliConfig,
} from "./src/nutrient-cli.js";

const INSTALL_HINT = "npm install -g @pspdfkit/pdf-to-markdown";
const UNAVAILABLE_MESSAGE = `Nutrient PDF CLI is not available. Install with: ${INSTALL_HINT}`;

/**
 * Returns an error message when the CLI is unavailable, or null when it is ready.
 * Single source of truth for the three call sites that gate on availability.
 */
async function ensureCliAvailable(command?: string): Promise<string | null> {
  const available = await isNutrientCliAvailable(command);
  return available ? null : UNAVAILABLE_MESSAGE;
}

export default definePluginEntry({
  id: "nutrient-pdf",
  name: "Nutrient PDF",
  description: "Nutrient-powered PDF extraction with markdown table and heading preservation",

  register(api: OpenClawPluginApi) {
    const config = coercePluginConfig(api.pluginConfig);
    const cliConfig: NutrientCliConfig = {
      command: config.command,
      timeoutMs: config.timeoutMs,
    };

    // ------------------------------------------------------------------
    // Startup: check CLI availability and log configuration guidance
    // ------------------------------------------------------------------

    void (async () => {
      const available = await isNutrientCliAvailable(config.command);
      if (!available) {
        api.logger.warn(`nutrient-pdf: pdf-to-markdown CLI not found. Install with: ${INSTALL_HINT}`);
        return;
      }

      const version = await getNutrientCliVersion(config.command);
      api.logger.info(`nutrient-pdf: CLI available${version ? ` (${version})` : ""}`);
      api.logger.info(
        "nutrient-pdf: use the nutrient_pdf_extract tool or `openclaw nutrient-pdf extract <file.pdf>` for on-demand extraction.",
      );
    })();

    // ------------------------------------------------------------------
    // Tool: nutrient_pdf_extract
    // ------------------------------------------------------------------

    api.registerTool(
      {
        name: "nutrient_pdf_extract",
        label: "Nutrient PDF Extract",
        description:
          "Extract text and structure from a PDF using Nutrient's pdf-to-markdown engine. " +
          "Returns clean Markdown with preserved tables, headings, and reading order. " +
          "Use this when you need high-fidelity PDF extraction, especially for documents with tables or complex layouts.",
        parameters: Type.Object({
          pdf: Type.String({
            description: "Path to a local PDF file",
          }),
        }),
        async execute(_toolCallId, params) {
          const { pdf: pdfPath } = params as { pdf: string };

          const unavailable = await ensureCliAvailable(config.command);
          if (unavailable) {
            return {
              content: [{ type: "text", text: unavailable }],
              details: { error: "cli_not_available" },
            };
          }

          try {
            // Validate path: enforce .pdf extension and size cap
            const { buffer } = await validatePdfPath(pdfPath);
            const result = await extractWithNutrientCli(buffer, cliConfig);
            return {
              content: [{ type: "text", text: result.markdown }],
              details: {
                engine: "nutrient",
                chars: result.markdown.length,
                durationMs: result.durationMs,
                ...(result.stderrSnippet ? { stderrSnippet: result.stderrSnippet } : {}),
              },
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Nutrient extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              details: {
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "nutrient_pdf_extract" },
    );

    // ------------------------------------------------------------------
    // CLI: openclaw nutrient-pdf status | extract
    // ------------------------------------------------------------------

    api.registerCli(
      ({ program }) => {
        const cmd = program.command("nutrient-pdf").description("Nutrient PDF extraction plugin");

        cmd
          .command("status")
          .description("Check Nutrient CLI availability and version")
          .action(async () => {
            const available = await isNutrientCliAvailable(config.command);
            const version = available ? await getNutrientCliVersion(config.command) : null;
            console.log(`Nutrient CLI: ${available ? "available" : "not found"}`);
            if (version) {
              console.log(`Version: ${version}`);
            }
            console.log(`Command: ${config.command ?? "pdf-to-markdown (auto-resolved)"}`);
            console.log(`Timeout: ${config.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`);
          });

        cmd
          .command("extract")
          .description("Extract markdown from a PDF")
          .argument("<pdf>", "Path to PDF file")
          .action(async (pdfPath: string) => {
            const unavailable = await ensureCliAvailable(config.command);
            if (unavailable) {
              console.error(unavailable);
              process.exitCode = 1;
              return;
            }
            try {
              const { buffer } = await validatePdfPath(pdfPath);
              const result = await extractWithNutrientCli(buffer, cliConfig);
              console.log(result.markdown);
            } catch (error) {
              console.error(
                `Nutrient extraction failed: ${error instanceof Error ? error.message : String(error)}`,
              );
              process.exitCode = 1;
            }
          });
      },
      { commands: ["nutrient-pdf"] },
    );

    // ------------------------------------------------------------------
    // Service registration
    // ------------------------------------------------------------------

    api.registerService({
      id: "nutrient-pdf",
      start: () => {
        api.logger.info("nutrient-pdf: service started");
      },
      stop: () => {
        api.logger.info("nutrient-pdf: service stopped");
      },
    });
  },
});
