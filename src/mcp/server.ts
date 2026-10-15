import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import type { Config } from "../config.js";
import { withVisionBackend } from "../services/context.js";
import { VisionProvider } from "../providers/openai.js";
import { packageInfo } from "../package-info.js";
import { registerUiToArtifactTool } from "../tools/ui-to-artifact.js";
import { registerTextExtractionTool } from "../tools/text-extraction.js";
import { registerErrorDiagnosisTool } from "../tools/error-diagnosis.js";
import { registerDiagramAnalysisTool } from "../tools/diagram-analysis.js";
import { registerDataVizAnalysisTool } from "../tools/data-viz.js";
import { registerUiDiffCheckTool } from "../tools/ui-diff.js";
import { registerGeneralImageAnalysisTool } from "../tools/general-image.js";

export function createServer(config: Config): McpServer {
  const server = new McpServer(packageInfo);
  const provider = new VisionProvider(config);
  const registration = {
    tool(
      name: string,
      description: string,
      schema: ZodRawShape,
      handler: (args: Record<string, unknown>) => Promise<CallToolResult>,
    ) {
      return server.tool(name, description, schema, (args, extra) =>
        withVisionBackend(provider, extra.signal, () => handler(args)),
      );
    },
  };
  for (const register of [
    registerUiToArtifactTool,
    registerTextExtractionTool,
    registerErrorDiagnosisTool,
    registerDiagramAnalysisTool,
    registerDataVizAnalysisTool,
    registerUiDiffCheckTool,
    registerGeneralImageAnalysisTool,
  ])
    register(registration);
  // Video implementation remains in tools/video-analysis.js, intentionally unregistered.
  return server;
}
