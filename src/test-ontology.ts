import "dotenv/config";
import { FabricMcpClient } from "./tools/fabric.js";

// ============================================================================
// Test de Ontología de Fabric
// ============================================================================

interface OntologyResult {
  question: number;
  prompt: string;
  response: string;
  timestamp: string;
}

async function runOntologyTest(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     AgentTickets3B - Exploración de Ontología Fabric      ║");
  console.log("║     Descubriendo estructura real del Data Agent           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // Preguntas secuenciales para descubrir la ontología
  const questions = [
    "¿Cuáles son todas las tablas disponibles en la ontología de tickets?",
    "¿Qué columnas tiene la tabla principal de tickets y qué significa cada una?",
    "¿Qué tablas de configuración existen (grupos, categorías, prioridades, tipos)?",
    "¿Qué tabla contiene el historial o log de acciones de los tickets?",
    "Dame un ejemplo de 3 tickets completos con todos sus campos relacionados",
  ];

  const results: OntologyResult[] = [];

  // Inicializar cliente de Fabric
  console.log("\n🔌 Inicializando cliente de Fabric...");
  const fabricClient = new FabricMcpClient();
  try {
    await fabricClient.initialize();
    console.log("✓ Cliente de Fabric inicializado\n");
  } catch (error) {
    console.error(
      `❌ Error al inicializar Fabric: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Ejecutar preguntas secuencialmente
  for (let i = 0; i < questions.length; i++) {
    const questionNumber = i + 1;
    const question = questions[i];

    console.log(`\n${"═".repeat(60)}`);
    console.log(`📋 Pregunta ${questionNumber}/${questions.length}`);
    console.log(`${"═".repeat(60)}`);
    console.log(`\n❓ ${question}\n`);

    try {
      console.log("⏳ Consultando Data Agent...");
      const response = await fabricClient.query(question);

      console.log(`\n✓ Respuesta recibida (${response.length} caracteres)\n`);
      console.log("📄 Contenido:\n");
      console.log(response);

      results.push({
        question: questionNumber,
        prompt: question,
        response,
        timestamp: new Date().toISOString(),
      });

      // Pequeña pausa entre preguntas para no sobrecargar
      if (i < questions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Error: ${errorMsg}`);

      results.push({
        question: questionNumber,
        prompt: question,
        response: `ERROR: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Generar documento markdown con los resultados
  console.log(`\n${"═".repeat(60)}`);
  console.log("📝 Compilando ontología descubierta...");
  console.log(`${"═".repeat(60)}\n`);

  const markdown = generateOntologyMarkdown(results);

  // Guardar archivo
  const fs = await import("fs/promises");
  const path = new URL("../docs/ontology-from-fabric.md", import.meta.url);

  try {
    // Crear directorio si no existe
    const docsDir = new URL("../docs", import.meta.url).pathname;
    try {
      await fs.mkdir(docsDir, { recursive: true });
    } catch {
      // El directorio ya existe o no se puede crear
    }

    await fs.writeFile(path, markdown, "utf-8");
    console.log(`✓ Ontología guardada en: docs/ontology-from-fabric.md\n`);
  } catch (error) {
    console.error(
      `❌ Error al guardar archivo: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Resumen final
  console.log("✅ Exploración de ontología completada exitosamente\n");
  process.exit(0);
}

function generateOntologyMarkdown(results: OntologyResult[]): string {
  const now = new Date().toISOString();

  let content = `# RetailTicketGoldOntology - Ontología de Fabric

**Descubierta:** ${now}

## Descripción

Este documento contiene la estructura real de la ontología de tickets de retail, descubierta consultando directamente al Data Agent de Microsoft Fabric.

---

`;

  for (const result of results) {
    content += `## Pregunta ${result.question}: ${result.prompt}

**Timestamp:** ${result.timestamp}

### Respuesta

\`\`\`
${result.response}
\`\`\`

---

`;
  }

  content += `## Notas de Implementación

- Las respuestas fueron obtenidas del Data Agent de Fabric en lenguaje natural
- Procesar estas respuestas es responsabilidad de los agentes analizadores
- Los campos y relaciones descritas aquí deben ser usados en \`src/agent/prompts.ts\`
- Esta ontología es **definitiva** para las consultas al Data Lake

---

*Generado automáticamente por \`test:ontology\`*
`;

  return content;
}

// ============================================================================
// Ejecución
// ============================================================================

runOntologyTest().catch((error) => {
  console.error(
    "❌ Error fatal:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
