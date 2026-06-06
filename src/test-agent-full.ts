import "dotenv/config";
import { Anthropic, toFile } from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { config } from "./config.js";
import { getCachedAccessToken } from "./auth/azure.js";
import { FabricMcpClient } from "./tools/fabric.js";
import { SYSTEM_PROMPT, ANALYST_PROMPT, REPORTER_PROMPT } from "./agent/prompts.js";

// ============================================================================
// Definición del Tool para Fabric
// ============================================================================

const QueryFabricSchema = z.object({
  question: z
    .string()
    .describe("La pregunta a hacer al Data Agent de Fabric en lenguaje natural"),
});

type QueryFabricInput = z.infer<typeof QueryFabricSchema>;

// ============================================================================
// Inicialización del Cliente de Anthropic
// ============================================================================

const client = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

// ============================================================================
// Estado del Agente
// ============================================================================

interface AgentState {
  fabricClient: FabricMcpClient | null;
  conversationMessages: MessageParam[];
  turnCount: number;
  maxTurns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

const agentState: AgentState = {
  fabricClient: null,
  conversationMessages: [],
  turnCount: 0,
  maxTurns: 10,
  totalInputTokens: 0,
  totalOutputTokens: 0,
};

// ============================================================================
// Funciones Auxiliares
// ============================================================================

function formatCost(inputTokens: number, outputTokens: number): string {
  // Precios de Claude 3.5 Sonnet (aprox)
  const inputCost = (inputTokens / 1_000_000) * 3; // $3 por millón tokens
  const outputCost = (outputTokens / 1_000_000) * 15; // $15 por millón tokens
  const totalCost = inputCost + outputCost;

  return `$${totalCost.toFixed(6)} (${inputTokens} input, ${outputTokens} output)`;
}

function displayMessage(
  type: string,
  content: unknown,
  indent: string = ""
): void {
  switch (type) {
    case "text":
      console.log(`\n${indent}📝 Assistant:\n${indent}${content}`);
      break;
    case "tool_use":
      const toolUse = content as {
        name: string;
        input: unknown;
        id: string;
      };
      console.log(
        `\n${indent}🔧 Tool Use: ${toolUse.name}`
      );
      console.log(`${indent}   Input: ${JSON.stringify(toolUse.input)}`);
      break;
    case "tool_result":
      console.log(`\n${indent}✓ Tool Result:`);
      if (typeof content === "string" && content.length > 200) {
        console.log(`${indent}   ${content.substring(0, 200)}...`);
      } else {
        console.log(`${indent}   ${JSON.stringify(content).substring(0, 200)}...`);
      }
      break;
  }
}

// ============================================================================
// Función Principal: Prueba del Agente
// ============================================================================

async function runAgentTest(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     AgentTickets3B - Test del Agente Completo             ║");
  console.log("║     Usando Claude Agent SDK + Fabric MCP                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Inicializar cliente de Fabric
  console.log("\n🔌 Inicializando cliente de Fabric...");
  agentState.fabricClient = new FabricMcpClient();
  try {
    await agentState.fabricClient.initialize();
    console.log("✓ Cliente de Fabric inicializado");
  } catch (error) {
    console.error(
      `❌ Error al inicializar Fabric: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Prompt inicial
  const userPrompt = `Analizá los tickets de los últimos 7 días. Identificá qué tiendas tienen mayor volumen,
si hay tickets repetidos o anomalías, y dame un resumen ejecutivo de máximo 5 puntos clave.

Por favor:
1. Usa el tool queryFabric para obtener datos del Data Lake
2. Analiza los datos obtenidos
3. Estructura un reporte JSON con los hallazgos principales
4. Genera un resumen ejecutivo legible`;

  console.log("\n📝 Enviando prompt al agente...");
  console.log(`\n${userPrompt}\n`);
  console.log("═".repeat(60));

  // Agregar mensaje inicial
  agentState.conversationMessages.push({
    role: "user",
    content: userPrompt,
  });

  // Loop principal del agente
  let isRunning = true;

  while (isRunning && agentState.turnCount < agentState.maxTurns) {
    agentState.turnCount++;
    console.log(`\n🔄 Turn ${agentState.turnCount}/${agentState.maxTurns}`);

    try {
      // Llamar al API de Anthropic
      const response = await client.messages.create({
        model: config.LLM_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: "queryFabric",
            description:
              "Consulta el Data Agent de Fabric para obtener datos de tickets y transacciones",
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
        messages: agentState.conversationMessages,
      });

      // Acumular tokens
      agentState.totalInputTokens += response.usage.input_tokens;
      agentState.totalOutputTokens += response.usage.output_tokens;

      // Agregar respuesta del asistente al historial
      agentState.conversationMessages.push({
        role: "assistant",
        content: response.content as any,
      });

      // Si hay tool use, procesar
      if (response.stop_reason === "tool_use") {
        const toolResults: Array<any> = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            displayMessage("tool_use", {
              name: block.name,
              input: block.input,
              id: block.id,
            });

            if (block.name === "queryFabric") {
              const input = block.input as QueryFabricInput;
              console.log(`\n⚙️  Ejecutando queryFabric...`);
              console.log(`   Pregunta: "${input.question}"`);

              try {
                const fabricResult = await agentState.fabricClient!.query(
                  input.question
                );
                console.log(`✓ Respuesta de Fabric recibida (${fabricResult.length} caracteres)`);

                displayMessage("tool_result", fabricResult);

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: fabricResult,
                });
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Error: ${errorMsg}`);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: `Error: ${errorMsg}`,
                });
              }
            }
          } else if (block.type === "text") {
            displayMessage("text", block.text);
          }
        }

        // Agregar resultados al mensaje
        if (toolResults.length > 0) {
          agentState.conversationMessages.push({
            role: "user",
            content: toolResults as any,
          });
        }
      } else if (response.stop_reason === "end_turn") {
        // El agente terminó
        isRunning = false;
        console.log("\n✓ Agente completado");
      } else {
        console.log(`\nStop reason: ${response.stop_reason}`);
        isRunning = false;
      }
    } catch (error) {
      console.error(
        `\n❌ Error en turn ${agentState.turnCount}: ${error instanceof Error ? error.message : String(error)}`
      );
      isRunning = false;
    }
  }

  // Resumen final
  console.log("\n" + "═".repeat(60));
  console.log("📊 RESUMEN FINAL");
  console.log("═".repeat(60));

  console.log(`\nTurns completados: ${agentState.turnCount}/${agentState.maxTurns}`);
  console.log(
    `Costo total: ${formatCost(agentState.totalInputTokens, agentState.totalOutputTokens)}`
  );

  if (!isRunning) {
    console.log("\n✅ Prueba completada exitosamente");
    process.exit(0);
  } else {
    console.log("\n⚠️  Prueba alcanzó límite de turns");
    process.exit(1);
  }
}

// ============================================================================
// Ejecución
// ============================================================================

runAgentTest().catch((error) => {
  console.error("❌ Error fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
