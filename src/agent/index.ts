import { config } from "../config.js";
import { getFabricMcpConfig } from "../tools/fabric.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { subAgents } from "./subagents.js";

interface AgentOptions {
  mode: "chat" | "scheduled";
}

interface McpServerConfig {
  type: "http";
  url: string;
  auth?: {
    type: "bearer";
    token: string;
  };
}

export async function createAgentConfig(options: AgentOptions) {
  const mcpServersConfig = await getFabricMcpConfig();

  return {
    systemPrompt: SYSTEM_PROMPT,
    mcpServers: mcpServersConfig as Record<string, McpServerConfig>,
    subagents: subAgents.map((agent) => ({
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
    })),
    permissionMode:
      options.mode === "scheduled" ? "acceptEdits" : ("default" as const),
    model: config.LLM_MODEL,
  };
}

export function logToolCall(
  toolName: string,
  input: unknown,
  timestamp: string
): void {
  console.log(`[${timestamp}] 🔧 Tool call: ${toolName}`);
  console.log(`  Input:`, input);
}

export function logToolResult(
  toolName: string,
  result: unknown,
  timestamp: string
): void {
  console.log(`[${timestamp}] ✓ Tool result: ${toolName}`);
  if (typeof result === "string" && result.length > 200) {
    console.log(`  Result: ${result.substring(0, 200)}...`);
  } else {
    console.log(`  Result:`, result);
  }
}
