import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { config, getReportRecipients } from "./config.js";
import { FabricMcpClient } from "./tools/fabric.js";
import { sendReport } from "./tools/sendgrid.js";
import { getCachedAccessToken } from "./auth/azure.js";
import { generateHTMLFromFabricData, type FabricData } from "./templates/report-template.js";

const reportDir = "reports";
mkdirSync(reportDir, { recursive: true });

async function fetchFabricData(): Promise<{ data: FabricData; client: FabricMcpClient | null }> {
  console.log("\n📊 PASO 1: Obteniendo datos de Fabric");
  console.log("═".repeat(60));

  let fabricClient: FabricMcpClient | null = null;
  try {
    fabricClient = new FabricMcpClient();
    await fabricClient.initialize();
    console.log("✓ Cliente MCP de Fabric inicializado\n");
  } catch (error) {
    console.warn("⚠️  MCP no disponible, usando fallback OpenAI...\n");
    fabricClient = null;
  }

  const questions = [
    { key: "estado",      label: "Obteniendo estado de tickets (abiertos/cerrados/vencidos)", q: "Dame estos 5 números exactos en orden: total de tickets, abiertos, cerrados, vencidos, sin asignar. Responde solo: número,número,número,número,número" },
    { key: "creacion",    label: "Obteniendo tickets por fecha de creación",                  q: "¿Cuántos tickets en estos períodos? Hoy: X, Esta Semana: Y, Este Mes: Z. Responde: X,Y,Z" },
    { key: "tiempos",    label: "Obteniendo tiempos de resolución",                          q: "¿Tiempo promedio en horas y % cumplimiento SLA? Dame: 12.5,85.5 (sin unidades)" },
    { key: "comparativa", label: "Obteniendo comparativa semana anterior",                    q: "Porcentaje cambio creados y cerrados esta semana vs anterior. Dame: +5,-10 (con signo)" },
    { key: "categoria",   label: "Obteniendo distribución por categoría",                     q: "¿Cuál es la distribución de tickets por categoría? Formato: - Nombre: cantidad" },
    { key: "sla",         label: "Obteniendo cumplimiento de SLA",                            q: "¿Cuántos tickets cumplen SLA y cuántos no cumplen? Formato: - Dentro: número, - Fuera: número" },
    { key: "canal",       label: "Obteniendo distribución por canal",                         q: "¿Cuál es la distribución de tickets por canal de origen? Formato: - Canal: cantidad" },
    { key: "tipo",        label: "Obteniendo distribución por tipo",                          q: "¿Cuál es la distribución de tickets por tipo? Formato: - Tipo: cantidad" },
  ];

  const responses: { [key: string]: string } = {};

  for (const item of questions) {
    console.log(`⏳ ${item.label}...`);
    try {
      if (fabricClient) {
        responses[item.key] = await fabricClient.query(item.q);
      } else {
        const token = await getCachedAccessToken();
        const response = await fetch(config.FABRIC_OPENAI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: item.q }],
          }),
        });
        const data = (await response.json()) as Record<string, unknown>;
        const choices = data.choices as Array<{ message: { content: string } }> | undefined;
        responses[item.key] = choices?.[0]?.message?.content || "";
      }
      console.log(`   ✓\n`);
    } catch (error) {
      console.warn(`   ⚠️  Error\n`);
      responses[item.key] = "";
    }
  }

  const extractNumbers = (text: string): number[] => {
    const matches = text.match(/(\d+(?:\.\d+)?)/g) || [];
    return matches.map(m => {
      const num = parseFloat(m);
      return num % 1 === 0 ? parseInt(m) : num;
    });
  };

  const parseItems = (text: string): Array<{ nombre: string; cantidad: number }> => {
    const items: Array<{ nombre: string; cantidad: number }> = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const match = line.match(/(?:[-•]\s*)?([^:]+):\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const nombre = match[1].trim();
        const cantidad = parseFloat(match[2]);
        if (nombre.length > 0 && !nombre.match(/^\d+$/)) {
          items.push({
            nombre,
            cantidad: cantidad % 1 === 0 ? parseInt(match[2]) : cantidad
          });
        }
      }
    }
    return items;
  };

  const estadoNums = extractNumbers(responses["estado"]);
  const total = Math.max(estadoNums[0] || 0, 1);
  const abiertos = estadoNums[1] || 0;
  const cerrados = Math.min(estadoNums[2] || 0, total);
  const vencidos = estadoNums[3] || 0;
  const sinAsignar = estadoNums[4] || 0;

  const creacionNums = extractNumbers(responses["creacion"]);
  const ticketsHoy = creacionNums[0] || 0;
  const estaSemana = creacionNums[1] || 0;
  const esteMes = creacionNums[2] || 0;

  const tiemposNums = extractNumbers(responses["tiempos"]);
  const diasPromedioHastaCerrar = tiemposNums[0] ? `${tiemposNums[0].toFixed(1)} horas` : "0 hrs";
  const slaPercent = Math.min(tiemposNums[1] || 0, 100);

  const comparativaNums = extractNumbers(responses["comparativa"]);
  const creadosPctChange = Math.min(comparativaNums[0] || 0, 100);
  const cerradosPctChange = Math.min(comparativaNums[1] || 0, 100);

  const slaNums = extractNumbers(responses["sla"]);
  const slaCompliant = slaNums[0] || 0;
  const slaExceeded = slaNums[1] || 0;

  const data: FabricData = {
    totalTickets: total,
    abiertos,
    cerrados,
    vencidos,
    sinAsignar,
    porcentajeCierre: (cerrados / total) * 100,
    ticketsHoy,
    estaSemana,
    esteMes,
    diasPromedioHastaCerrar,
    porcentajeCumplimientoSLA: slaPercent,
    creadosPct: creadosPctChange,
    cerradosPct: cerradosPctChange,
    distribucionCategoria: parseItems(responses["categoria"]),
    slaCompliant,
    slaExceeded,
    distribucionCanal: parseItems(responses["canal"]),
    distribucionTipo: parseItems(responses["tipo"]),
  };

  console.log("✓ Datos parseados\n");
  return { data, client: fabricClient };
}

function buildAnalysisContext(data: FabricData): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data as unknown as Record<string, unknown>)) {
    if (key === "analisisInteligente") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          const parts = Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
          lines.push(`  - ${parts}`);
        }
      }
    } else if (value !== null && value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Regenerar HTML con Estructura Outlook   ║");
  console.log("║  Fabric (datos) → HTML (estructura report-preview)      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const startTime = Date.now();

  try {
    const { data, client: fabricClient } = await fetchFabricData();

    console.log("\n🧠 PASO 2: Análisis Ejecutivo con IA");
    console.log("═".repeat(60));
    if (fabricClient) {
      try {
        const analysisPrompt = `
Basándote en estos datos reales del sistema de tickets de Tiendas 3B:

${buildAnalysisContext(data)}

Dame un análisis ejecutivo conciso con:
1. Situación general del sistema de tickets
2. Principales anomalías o puntos de atención
3. Recomendaciones concretas para el equipo de soporte
4. Tendencia: ¿la operación está mejorando o empeorando?

Responde en español, profesional y directo. Máximo 200 palabras.
`;
        const analisis = await fabricClient.query(analysisPrompt);
        data.analisisInteligente = analisis;
        console.log("✓ Análisis generado\n");
      } catch (error) {
        console.warn("⚠️  No se pudo generar análisis, continuando sin él...\n");
      }
    } else {
      console.log("⚠️  MCP no disponible, omitiendo análisis\n");
    }

    console.log("\n📄 PASO 3: Regenerando HTML con estructura Outlook");
    console.log("═".repeat(60));
    const html = generateHTMLFromFabricData(data);
    console.log(`✓ HTML regenerado (${html.length} caracteres)\n`);

    console.log("💾 PASO 4: Guardando report-official.html");
    console.log("═".repeat(60));
    const filepath = `${reportDir}/report-official.html`;
    writeFileSync(filepath, html, "utf-8");
    console.log(`✓ Reporte guardado en: ${filepath}\n`);

    console.log("📧 PASO 5: Enviando por email");
    console.log("═".repeat(60));
    const recipients = getReportRecipients();
    const today = new Date();
    const subject = `📊 Reporte Semanal de Tickets - Tiendas 3B (${today.toLocaleDateString("es-BO")})`;
    await sendReport(html, subject, recipients);
    console.log(`✓ Email enviado a: ${recipients.join(", ")}\n`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                    ✅ COMPLETADO                          ║");
    console.log(`║                 Tiempo: ${elapsed}s                         ║`);
    console.log("╚════════════════════════════════════════════════════════════╝");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
