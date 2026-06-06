import dotenv from "dotenv";

// Cargar variables de entorno
const envPath = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
dotenv.config({ path: envPath, override: false });

import { config } from "./config.js";
import { runChatMode } from "./modes/chat.js";
import { runScheduledMode } from "./modes/scheduled.js";

async function main(): Promise<void> {
  try {
    // Detectar modo de ejecución
    let mode: "chat" | "scheduled" = config.MODE;

    // Override basado en argumentos
    const args = process.argv.slice(2);
    if (args.includes("chat")) {
      mode = "chat";
    } else if (args.includes("scheduled")) {
      mode = "scheduled";
    }

    console.log(`🚀 AgentTickets3B - Modo: ${mode}`);
    console.log("═════════════════════════════════════════\n");

    if (mode === "chat") {
      await runChatMode();
    } else if (mode === "scheduled") {
      await runScheduledMode();
    }
  } catch (error) {
    console.error(
      "❌ Error fatal:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
