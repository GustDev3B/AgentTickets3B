import "dotenv/config";
import * as readline from "readline";
import { randomUUID } from "crypto";
import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { config, getReportRecipients } from "../config.js";
import { FabricMcpClient } from "../tools/fabric.js";
import { SYSTEM_PROMPT } from "../agent/prompts.js";

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
// Cliente de Anthropic
// ============================================================================

const client = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

// ============================================================================
// Estado de la Sesión de Chat
// ============================================================================

interface ChatState {
  sessionId: string;
  conversationMessages: MessageParam[];
  fabricClient: FabricMcpClient | null;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// ============================================================================
// Funciones Auxiliares
// ============================================================================

async function processAgentResponse(
  state: ChatState,
  userMessage: string
): Promise<string> {
  // Agregar mensaje del usuario
  state.conversationMessages.push({
    role: "user",
    content: userMessage,
  });

  let finalResponse = "";
  let isRunning = true;
  let turnCount = 0;
  const maxTurns = 5;

  while (isRunning && turnCount < maxTurns) {
    turnCount++;

    try {
      // Llamar al API de Anthropic
      const response = await client.messages.create({
        model: config.LLM_MODEL,
        max_tokens: 2048,
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
        messages: state.conversationMessages,
      });

      // Acumular tokens
      state.totalInputTokens += response.usage.input_tokens;
      state.totalOutputTokens += response.usage.output_tokens;

      // Agregar respuesta del asistente al historial
      state.conversationMessages.push({
        role: "assistant",
        content: response.content as any,
      });

      // Procesar contenido de la respuesta
      const toolResults: Array<any> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          finalResponse = block.text;
        } else if (block.type === "tool_use") {
          if (block.name === "queryFabric") {
            const input = block.input as QueryFabricInput;
            try {
              const fabricResult = await state.fabricClient!.query(
                input.question
              );
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: fabricResult,
              });
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Error: ${errorMsg}`,
              });
            }
          }
        }
      }

      // Agregar resultados de herramientas si existen
      if (toolResults.length > 0) {
        state.conversationMessages.push({
          role: "user",
          content: toolResults as any,
        });
      }

      // Si el agente terminó, salir del loop
      if (response.stop_reason === "end_turn" || toolResults.length === 0) {
        isRunning = false;
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Error en turn ${turnCount}: ${errorMsg}`);
      finalResponse = `Error: ${errorMsg}`;
      isRunning = false;
    }
  }

  return finalResponse;
}

// ============================================================================
// Función Principal: Modo Chat
// ============================================================================

export async function runChatMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Modo Chat Interactivo   ║");
  console.log("╚════════════════════════════════════════════╝\n");

  console.log("Comandos disponibles:");
  console.log("  /exit    - Salir de la aplicación");
  console.log("  /new     - Iniciar una nueva sesión");
  console.log("  /report  - Generar reporte semanal completo");
  console.log("  /help    - Mostrar esta ayuda\n");

  // Inicializar cliente de Fabric
  const fabricClient = new FabricMcpClient();
  try {
    await fabricClient.initialize();
  } catch (error) {
    console.error(
      `❌ Error al inicializar Fabric: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Estado inicial
  let state: ChatState = {
    sessionId: randomUUID(),
    conversationMessages: [],
    fabricClient,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  console.log(`Sesión iniciada: ${state.sessionId}\n`);

  const promptUser = (): void => {
    rl.question("Tú: ", async (input) => {
      const userInput = input.trim();

      if (!userInput) {
        promptUser();
        return;
      }

      // Manejar comandos especiales
      if (userInput === "/exit") {
        console.log("\n👋 ¡Hasta luego!\n");
        rl.close();
        process.exit(0);
      }

      if (userInput === "/new") {
        state = {
          sessionId: randomUUID(),
          conversationMessages: [],
          fabricClient,
          totalInputTokens: 0,
          totalOutputTokens: 0,
        };
        console.log(`✓ Nueva sesión iniciada: ${state.sessionId}\n`);
        promptUser();
        return;
      }

      if (userInput === "/help") {
        console.log("\nComandos disponibles:");
        console.log("  /exit    - Salir de la aplicación");
        console.log("  /new     - Iniciar una nueva sesión");
        console.log("  /report  - Generar reporte semanal completo");
        console.log("  /help    - Mostrar esta ayuda\n");
        promptUser();
        return;
      }

      if (userInput === "/report") {
        console.log("\n📊 Generando reporte semanal...\n");
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const reportPrompt = `
Analiza los tickets de la semana del ${weekStart.toLocaleDateString("es-BO")} al ${weekEnd.toLocaleDateString("es-BO")}.

Por favor:
1. Consulta el Data Lake para obtener datos de tickets de esa semana
2. Genera un análisis completo con anomalías, tendencias y patrones
3. Identifica las tiendas con mayor volumen y los problemas más comunes
4. Proporciona un resumen ejecutivo de máximo 5 puntos clave

Utiliza el tool queryFabric para obtener datos precisos del sistema.
        `.trim();

        try {
          const reportResponse = await processAgentResponse(state, reportPrompt);
          console.log(`\nAsistente:\n${reportResponse}\n`);
        } catch (error) {
          console.error(
            `❌ Error al generar reporte: ${error instanceof Error ? error.message : String(error)}\n`
          );
        }

        promptUser();
        return;
      }

      // Procesar consulta normal
      try {
        console.log("\nAsistente: ");
        const response = await processAgentResponse(state, userInput);
        console.log(`${response}\n`);
      } catch (error) {
        console.error(
          `❌ Error: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }

      promptUser();
    });
  };

  // Manejar Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n\n👋 ¡Hasta luego!\n");
    rl.close();
    process.exit(0);
  });

  promptUser();
}
