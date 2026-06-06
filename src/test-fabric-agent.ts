import "dotenv/config";
import { getCachedAccessToken } from "./auth/azure.js";
import { config } from "./config.js";

interface McpResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

async function initializeMcp(): Promise<boolean> {
  console.log("\n🔌 Inicializando conexión MCP...");
  try {
    const token = await getCachedAccessToken();

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "AgentTickets3B",
          version: "1.0.0",
        },
      },
    };

    const response = await fetch(config.FABRIC_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as McpResponse;

    if (response.ok && data.result) {
      console.log("✓ MCP inicializado exitosamente");
      return true;
    } else {
      console.error("❌ Error al inicializar MCP:");
      console.error(JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.error(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

async function callFabricAgent(
  question: string
): Promise<{ success: boolean; response: unknown; duration: number }> {
  const startTime = Date.now();

  try {
    const token = await getCachedAccessToken();

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "DataAgent_TKTAgent",
        arguments: {
          userQuestion: question,
        },
      },
    };

    const response = await fetch(config.FABRIC_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as McpResponse;
    const duration = Date.now() - startTime;

    if (response.ok && data.result) {
      return {
        success: true,
        response: data.result,
        duration,
      };
    } else {
      return {
        success: false,
        response: data.error || data,
        duration,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      response: {
        error: error instanceof Error ? error.message : String(error),
      },
      duration,
    };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Test Fabric Agent        ║");
  console.log("║  Probando DataAgent_TKTAgent        ║");
  console.log("╚════════════════════════════════════════════╝");

  // Inicializar MCP
  const initialized = await initializeMcp();
  if (!initialized) {
    console.error("\n❌ No se pudo inicializar MCP. Abortando.");
    process.exit(1);
  }

  // Preguntas específicas para entender el formato de respuestas
  const questions = [
    "¿Cuál es el total de tickets registrados?",
    "¿Cuántos tickets están abiertos (EsCerrado=0) y cuántos cerrados (EsCerrado=1)?",
    "¿Cuántos tickets tienen SLAExcedido=1?",
    "¿Cuántos tickets no tienen grupo asignado (NombreGrupo vacío o nulo)?",
    "¿Cuántos tickets se crearon en los últimos 7 días?",
    "¿Cuál es la distribución de tickets por NombreCanal?",
    "¿Cuál es la distribución de tickets por NombreTipoTicket?",
    "¿Cuál es la distribución de tickets por NombreCategoria?",
    "¿Cuántos tickets hay por cada NombrePrioridad?",
    "¿Cuántos tickets se crearon por cada día de la semana en los últimos 30 días?",
  ];

  const results: Array<{
    question: string;
    duration: number;
    success: boolean;
    response: unknown;
  }> = [];

  // Ejecutar preguntas en secuencia
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNumber = i + 1;

    console.log("\n" + "═".repeat(60));
    console.log(`❓ PREGUNTA ${questionNumber}/${questions.length}`);
    console.log("═".repeat(60));
    console.log(`\n📝 ${question}\n`);

    console.log("⏳ Enviando solicitud a Fabric...");
    const result = await callFabricAgent(question);

    results.push({
      question,
      duration: result.duration,
      success: result.success,
      response: result.response,
    });

    if (result.success) {
      console.log(`✓ Respuesta recibida en ${formatDuration(result.duration)}\n`);
      console.log("📄 RESPUESTA COMPLETA:");
      console.log("─".repeat(60));
      console.log(JSON.stringify(result.response, null, 2));
      console.log("─".repeat(60));
    } else {
      console.log(
        `❌ Error (${formatDuration(result.duration)})\n`
      );
      console.log("📄 ERROR:");
      console.log("─".repeat(60));
      console.log(JSON.stringify(result.response, null, 2));
      console.log("─".repeat(60));
    }

    // Esperar 1 segundo entre preguntas para no sobrecargar
    if (i < questions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Resumen final
  console.log("\n" + "═".repeat(60));
  console.log("📊 RESUMEN DE PRUEBAS");
  console.log("═".repeat(60));
  console.log();

  const successful = results.filter((r) => r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result, index) => {
    const icon = result.success ? "✓" : "❌";
    console.log(
      `${icon} Pregunta ${index + 1}: ${formatDuration(result.duration)}`
    );
  });

  console.log("\n" + "─".repeat(60));
  console.log(`✅ Exitosas: ${successful}/${results.length}`);
  console.log(`⏱️  Tiempo total: ${formatDuration(totalDuration)}`);
  console.log(`⏱️  Tiempo promedio: ${formatDuration(totalDuration / results.length)}`);
  console.log("─".repeat(60));

  if (successful === results.length) {
    console.log("\n🎉 ¡Todas las preguntas se respondieron exitosamente!");
    process.exit(0);
  } else {
    console.log(
      `\n⚠️  ${results.length - successful} pregunta(s) fallaron.`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "❌ Error fatal:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
