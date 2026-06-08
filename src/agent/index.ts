import { config } from "../config.js";
import { getFabricMcpConfig } from "../tools/fabric.js";
import { SYSTEM_PROMPT, ANALYST_PROMPT, REPORTER_PROMPT } from "./prompts.js";
import type { Options } from "@anthropic-ai/claude-agent-sdk";

const FABRIC_TOOL = "mcp__fabric-data__DataAgent_TKTAgent";

export async function createQueryOptions(
  mode: "chat" | "scheduled",
  resumeSessionId?: string
): Promise<Options> {
  const mcpServers = await getFabricMcpConfig();

  const options: Options = {
    systemPrompt: SYSTEM_PROMPT,
    mcpServers,
    agents: {
      "data-analyst": {
        description:
          "Consulta el Data Lake de Fabric y analiza tickets de soporte retail",
        prompt: ANALYST_PROMPT,
        tools: [FABRIC_TOOL],
      },
      "report-generator": {
        description:
          "Genera reportes HTML profesionales a partir de datos estructurados de tickets",
        prompt: REPORTER_PROMPT,
      },
    },
    allowedTools: ["Agent", FABRIC_TOOL],
    permissionMode: "acceptEdits",
    maxTurns: mode === "scheduled" ? 15 : 5,
    model: config.LLM_MODEL,
  };

  if (resumeSessionId) {
    options.resume = resumeSessionId;
  }

  return options;
}
