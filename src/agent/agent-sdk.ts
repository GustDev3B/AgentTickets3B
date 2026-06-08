import { Anthropic } from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { config } from "../config.js";
import { FabricMcpClient } from "../tools/fabric.js";
import { SYSTEM_PROMPT } from "./prompts.js";

const QueryFabricSchema = z.object({
  question: z
    .string()
    .describe("La pregunta a hacer al Data Agent de Fabric en lenguaje natural"),
});

type QueryFabricInput = z.infer<typeof QueryFabricSchema>;

export interface AgentSDKOptions {
  maxTurns?: number;
  maxTokens?: number;
  systemPrompt?: string;
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
}

export class AgentSDK {
  private client: Anthropic;
  private fabricClient: FabricMcpClient;
  private options: Required<AgentSDKOptions>;

  constructor(fabricClient: FabricMcpClient, options: AgentSDKOptions = {}) {
    this.client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
    });
    this.fabricClient = fabricClient;
    this.options = {
      maxTurns: options.maxTurns ?? 10,
      maxTokens: options.maxTokens ?? 4096,
      systemPrompt: options.systemPrompt ?? SYSTEM_PROMPT,
      onToolCall: options.onToolCall ?? (() => {}),
      onToolResult: options.onToolResult ?? (() => {}),
    };
  }

  async query(
    userMessage: string,
    messages: MessageParam[] = []
  ): Promise<{ response: string; messages: MessageParam[] }> {
    const allMessages: MessageParam[] = [
      ...messages,
      {
        role: "user",
        content: userMessage,
      },
    ];

    let finalResponse = "";
    let isRunning = true;
    let turnCount = 0;

    while (isRunning && turnCount < this.options.maxTurns) {
      turnCount++;

      const response = await this.client.messages.create({
        model: config.LLM_MODEL,
        max_tokens: this.options.maxTokens,
        system: this.options.systemPrompt,
        tools: [
          {
            name: "queryFabric",
            description:
              "Consulta el Data Agent de Fabric para obtener datos de tickets",
            input_schema: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description:
                    "La pregunta a hacer al Data Agent de Fabric en lenguaje natural",
                },
              },
              required: ["question"],
            },
          },
        ],
        messages: allMessages,
      });

      allMessages.push({
        role: "assistant",
        content: response.content as any,
      });

      const toolResults: Array<any> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          finalResponse = block.text;
        } else if (block.type === "tool_use") {
          if (block.name === "queryFabric") {
            const input = block.input as QueryFabricInput;
            this.options.onToolCall("queryFabric", input);

            try {
              const fabricResult = await this.fabricClient.query(
                input.question
              );
              this.options.onToolResult("queryFabric", fabricResult);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: fabricResult,
              });
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              this.options.onToolResult("queryFabric", `Error: ${errorMsg}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Error: ${errorMsg}`,
                is_error: true,
              });
            }
          }
        }
      }

      if (toolResults.length > 0) {
        allMessages.push({
          role: "user",
          content: toolResults as any,
        });
      }

      if (response.stop_reason === "end_turn" || toolResults.length === 0) {
        isRunning = false;
      }
    }

    return {
      response: finalResponse,
      messages: allMessages,
    };
  }
}

export async function createAgentSDK(
  fabricClient: FabricMcpClient,
  options?: AgentSDKOptions
): Promise<AgentSDK> {
  return new AgentSDK(fabricClient, options);
}
