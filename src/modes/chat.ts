import "dotenv/config";
import * as readline from "readline";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createQueryOptions } from "../agent/index.js";

interface ChatState {
  sessionId: string | null;
}

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

  const state: ChatState = { sessionId: null };

  const sendMessage = async (prompt: string): Promise<void> => {
    const options = await createQueryOptions(
      "chat",
      state.sessionId ?? undefined
    );
    options.includePartialMessages = true;

    const stream = query({ prompt, options });

    process.stdout.write("\nAsistente: ");
    let hasOutput = false;

    for await (const message of stream) {
      if (message.type === "system" && message.subtype === "init") {
        if (!state.sessionId) {
          state.sessionId = message.session_id;
        }
      } else if (message.type === "stream_event") {
        const event = message.event;
        if (event.type === "content_block_delta") {
          const delta = event.delta;
          if (delta.type === "text_delta") {
            process.stdout.write(delta.text);
            hasOutput = true;
          }
        }
      } else if (message.type === "result") {
        if (message.subtype !== "success") {
          console.error(`\n❌ Error del agente: ${message.subtype}`);
        }
      }
    }

    if (hasOutput) {
      console.log("\n");
    } else {
      console.log("(sin respuesta)\n");
    }
  };

  const promptUser = (): void => {
    rl.question("Tú: ", async (input) => {
      const userInput = input.trim();

      if (!userInput) {
        promptUser();
        return;
      }

      if (userInput === "/exit") {
        console.log("\n👋 ¡Hasta luego!\n");
        rl.close();
        process.exit(0);
      }

      if (userInput === "/new") {
        state.sessionId = null;
        console.log("✓ Nueva sesión iniciada\n");
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
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const reportPrompt =
          `Analiza los tickets de la semana del ${weekStart.toLocaleDateString("es-BO")} ` +
          `al ${weekEnd.toLocaleDateString("es-BO")}. ` +
          `1. Consulta el Data Lake para obtener datos de tickets de esa semana. ` +
          `2. Genera un análisis completo con anomalías, tendencias y patrones. ` +
          `3. Identifica los grupos con mayor volumen y los problemas más comunes. ` +
          `4. Proporciona un resumen ejecutivo de máximo 5 puntos clave.`;

        try {
          await sendMessage(reportPrompt);
        } catch (error) {
          console.error(
            `❌ Error al generar reporte: ${error instanceof Error ? error.message : String(error)}\n`
          );
        }

        promptUser();
        return;
      }

      try {
        await sendMessage(userInput);
      } catch (error) {
        console.error(
          `❌ Error: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }

      promptUser();
    });
  };

  process.on("SIGINT", () => {
    console.log("\n\n👋 ¡Hasta luego!\n");
    rl.close();
    process.exit(0);
  });

  promptUser();
}
