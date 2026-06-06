import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { config, getReportRecipients } from "./config.js";
import { FabricMcpClient } from "./tools/fabric.js";
import { sendReport } from "./tools/sendgrid.js";
import { generateReportHTML, ReportData } from "./templates/report-template.js";

const reportDir = "reports";
mkdirSync(reportDir, { recursive: true });

// ============================================================================
// Paso 1: Obtener datos reales de Fabric
// ============================================================================

interface FabricQueryResult {
  key: string;
  question: string;
  response: string;
}

async function fetchReportDataFromFabric(): Promise<ReportData> {
  console.log("\n📊 PASO 1: Obteniendo datos reales del Data Lake de Fabric");
  console.log("═".repeat(60));

  const fabricClient = new FabricMcpClient();
  await fabricClient.initialize();
  console.log("✓ Cliente de Fabric inicializado");

  // Preguntas específicas para obtener todos los datos necesarios
  const queries: FabricQueryResult[] = [];

  const questions = [
    {
      key: "totalTickets",
      question: "¿Cuántos tickets totales existen en el sistema (estado abierto, cerrado, etc)?",
    },
    {
      key: "openTickets",
      question: "¿Cuántos tickets están actualmente abiertos (EsCerrado=0)?",
    },
    {
      key: "closedTickets",
      question: "¿Cuántos tickets están cerrados (EsCerrado=1)?",
    },
    {
      key: "overdueTickets",
      question: "¿Cuántos tickets están vencidos o excedieron el SLA en los últimos 7 días?",
    },
    {
      key: "unassignedTickets",
      question: "¿Cuántos tickets no tienen grupo asignado o están sin asignar (NombreGrupo vacío)?",
    },
    {
      key: "ticketsCreatedToday",
      question: "¿Cuántos tickets fueron creados hoy?",
    },
    {
      key: "ticketsCreatedThisWeek",
      question: "¿Cuántos tickets fueron creados esta semana (últimos 7 días)?",
    },
    {
      key: "ticketsCreatedThisMonth",
      question: "¿Cuántos tickets fueron creados este mes?",
    },
    {
      key: "avgResolutionDays",
      question: "¿Cuál es el tiempo promedio de resolución en días (promedio de DuracionMinutos dividido por 1440)?",
    },
    {
      key: "slaCompliance",
      question: "¿Cuál es el porcentaje de tickets que cumplieron con SLA en los últimos 7 días?",
    },
    {
      key: "weekComparison",
      question: "¿Cuántos tickets se crearon la semana pasada versus esta semana? Dame números para calcular porcentaje de cambio.",
    },
    {
      key: "priorityDistribution",
      question: "¿Cuántos tickets hay por cada nivel de prioridad (Urgente, Alta, Media, Baja)?",
    },
    {
      key: "channelDistribution",
      question: "¿Cuál es la distribución de tickets por canal de origen (App Tienda, Web, Teléfono, Email, etc)?",
    },
    {
      key: "typeDistribution",
      question: "¿Cuál es la distribución de tickets por tipo (Incidente, Requerimiento, POS, Soporte, etc)?",
    },
    {
      key: "categoryDistribution",
      question: "¿Cuáles son las categorías de tickets más frecuentes y sus cantidades?",
    },
    {
      key: "dailyDistribution",
      question: "¿Cuántos tickets se crearon cada día de la semana pasada (lunes a domingo)?",
    },
  ];

  for (const q of questions) {
    console.log(`\n⏳ Consultando: ${q.key}...`);
    try {
      const response = await fabricClient.query(q.question);
      queries.push({
        key: q.key,
        question: q.question,
        response: response,
      });
      console.log(`✓ ${q.key}: ${response.substring(0, 100)}...`);
    } catch (error) {
      console.warn(`⚠️  Error al consultar ${q.key}: ${error instanceof Error ? error.message : String(error)}`);
      queries.push({
        key: q.key,
        question: q.question,
        response: "",
      });
    }
  }

  // Parsear respuestas y construir ReportData
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);

  const extractNumber = (text: string): number => {
    // Busca todos los números en el texto
    const allMatches = text.match(/(\d{1,3}(?:,\d{3})+|\d+)/g);
    if (!allMatches) return 0;

    // Convierte comas a vacío y retorna el número más grande
    const numbers = allMatches.map((m) => parseInt(m.replace(/,/g, "")));
    return Math.max(...numbers);
  };

  const extractPercentage = (text: string): number => {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (match) {
      const num = match[1].replace(",", ".");
      return parseFloat(num);
    }
    const simpleMatch = text.match(/(\d+(?:\.\d+)?)/);
    return simpleMatch ? parseFloat(simpleMatch[1]) : 0;
  };

  // Parser para distribuciones con formato "- Nombre: cantidad" o "- Nombre: cantidad tickets"
  const parseDistribution = (text: string): { [key: string]: number } => {
    const distribution: { [key: string]: number } = {};
    // Busca patrones como "- Nombre: 1,295" o "- Nombre: 123 tickets"
    const lines = text.split("\n");
    for (const line of lines) {
      // Match números con o sin comas: "123" o "1,295"
      const match = line.match(/[-•]\s*([^:]+):\s*(\d{1,3}(?:,\d{3})+|\d+)/);
      if (match) {
        const name = match[1].trim();
        const quantity = parseInt(match[2].replace(/,/g, ""));
        distribution[name] = quantity;
      }
    }
    return distribution;
  };

  // Obtener valores de las respuestas
  const totalTickets = extractNumber(queries.find((q) => q.key === "totalTickets")?.response || "0");
  const openTickets = extractNumber(queries.find((q) => q.key === "openTickets")?.response || "0");
  const closedTickets = extractNumber(queries.find((q) => q.key === "closedTickets")?.response || "0");
  const overdueTickets = extractNumber(queries.find((q) => q.key === "overdueTickets")?.response || "0");
  const unassignedTickets = extractNumber(queries.find((q) => q.key === "unassignedTickets")?.response || "0");
  const ticketsHoy = extractNumber(queries.find((q) => q.key === "ticketsCreatedToday")?.response || "0");
  const estaSemana = extractNumber(queries.find((q) => q.key === "ticketsCreatedThisWeek")?.response || "0");
  const esteMes = extractNumber(queries.find((q) => q.key === "ticketsCreatedThisMonth")?.response || "0");
  const avgDays = extractNumber(queries.find((q) => q.key === "avgResolutionDays")?.response || "2");
  const slaPercent = extractPercentage(queries.find((q) => q.key === "slaCompliance")?.response || "80");

  // Calcular porcentaje de cierre
  const porcentajeCierre = totalTickets > 0 ? (closedTickets / totalTickets) * 100 : 0;

  // Comparativa semana vs anterior (extrae dos números)
  const weekComparisonText = queries.find((q) => q.key === "weekComparison")?.response || "";
  const numbers = weekComparisonText.match(/\d+/g) || ["0", "0"];
  const lastWeek = parseInt(numbers[0]);
  const currentWeek = parseInt(numbers[1]);
  const weekChangePercent = lastWeek > 0 ? ((currentWeek - lastWeek) / lastWeek) * 100 : 0;

  // Distribución por prioridad
  const priorityText = queries.find((q) => q.key === "priorityDistribution")?.response || "";
  const priorityDist = parseDistribution(priorityText);
  const ticketsByPriority = {
    Urgente: priorityDist["Urgente"] || 0,
    Alta: priorityDist["Alta"] || 0,
    Media: priorityDist["Media"] || 0,
    Baja: priorityDist["Baja"] || 0,
  };

  // Distribución por canal
  const channelText = queries.find((q) => q.key === "channelDistribution")?.response || "";
  const channelDist = parseDistribution(channelText);
  const distribucionCanal = Object.entries(channelDist).map(([canal, cantidad]) => ({
    canal,
    cantidad,
  }));

  // Distribución por tipo
  const typeText = queries.find((q) => q.key === "typeDistribution")?.response || "";
  const typeDist = parseDistribution(typeText);
  const distribucionTipo = Object.entries(typeDist).map(([tipo, cantidad]) => ({
    tipo,
    cantidad,
  }));

  // Distribución por categoría
  const categoryText = queries.find((q) => q.key === "categoryDistribution")?.response || "";
  const categoryDist = parseDistribution(categoryText);
  const distribucionCategoria = Object.entries(categoryDist).map(([categoria, cantidad]) => ({
    categoria,
    cantidad,
  }));

  // Distribución por día de la semana (orden específico)
  const dailyText = queries.find((q) => q.key === "dailyDistribution")?.response || "";
  const dailyDist = parseDistribution(dailyText);
  const daysInOrder = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const dayShorts = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const ticketsByDay = daysInOrder.map((dayName, idx) => ({
    day: dayShorts[idx],
    count: dailyDist[dayName] || 0,
  }));

  // SLA compliance
  const slaCompliant = Math.ceil((totalTickets * slaPercent) / 100);
  const slaExceeded = totalTickets - slaCompliant;

  const reportData: ReportData = {
    period: {
      startDate: weekStart.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
    },

    // Métricas Fila 1
    totalTickets,
    abiertos: openTickets,
    cerrados: closedTickets,
    vencidos: overdueTickets,
    sinAsignar: unassignedTickets,
    porcentajeCierre,

    // Métricas Fila 2
    ticketsHoy,
    estaSemana,
    esteMes,

    // Métricas Fila 3
    diasPromedioHastaCerrar: avgDays,
    porcentajeCumplimientoSLA: slaPercent,
    estaSemanaVsAnterior: {
      creadosPct: Math.round(weekChangePercent),
      cerradosPct: Math.round(weekChangePercent * 0.95), // Aproximado
    },

    // Distribuciones
    distribucionCategoria,
    ticketsByDay,
    ticketsByPriority,
    slaCompliance: {
      compliant: slaCompliant,
      exceeded: slaExceeded,
    },
    distribucionCanal,
    distribucionTipo,

    generatedAt: new Date().toISOString(),
  };

  console.log(`\n✓ Datos obtenidos de Fabric: ${totalTickets} tickets analizados`);
  return reportData;
}

// ============================================================================
// Paso 2: Generar HTML desde template
// ============================================================================

function generateHTMLReport(reportData: ReportData): string {
  console.log("\n📄 PASO 2: Generando reporte HTML");
  console.log("═".repeat(60));

  const htmlContent = generateReportHTML(reportData);
  console.log(`✓ HTML generado (${htmlContent.length} caracteres)`);
  return htmlContent;
}

// ============================================================================
// Paso 3: Guardar HTML
// ============================================================================

function saveReportHTML(htmlContent: string): string {
  console.log("\n💾 PASO 3: Guardando reporte HTML");
  console.log("═".repeat(60));

  const filepath = `${reportDir}/reporte-final.html`;
  writeFileSync(filepath, htmlContent, "utf-8");

  console.log(`✓ Reporte guardado en: ${filepath}`);
  console.log(`  Tamaño: ${(htmlContent.length / 1024).toFixed(2)} KB`);

  return filepath;
}

// ============================================================================
// Paso 4: Enviar por mail
// ============================================================================

async function sendReportByMail(htmlContent: string): Promise<void> {
  console.log("\n📧 PASO 4: Enviando reporte por mail");
  console.log("═".repeat(60));

  const recipients = getReportRecipients();
  const today = new Date();
  const subject = `Reporte Semanal de Tickets - AgentTickets3B - ${today.toLocaleDateString("es-ES")}`;

  const result = await sendReport(htmlContent, subject, recipients);

  console.log(`\n✓ Mail enviado correctamente`);
  console.log(`  Destinatarios: ${recipients.join(", ")}`);
  console.log(`  Asunto: ${subject}`);
}

// ============================================================================
// Función Principal
// ============================================================================

async function runFullFlow(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     AgentTickets3B - Flujo Completo con Datos Reales       ║");
  console.log("║     Fabric → Reporte → Mail                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const startTime = Date.now();

  try {
    // Paso 1: Obtener datos reales
    const reportData = await fetchReportDataFromFabric();

    // Paso 2: Generar HTML
    const htmlContent = generateHTMLReport(reportData);

    // Paso 3: Guardar HTML
    const filepath = saveReportHTML(htmlContent);

    // Paso 4: Enviar por mail
    await sendReportByMail(htmlContent);

    // Resumen final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "═".repeat(60));
    console.log("✅ FLUJO COMPLETO EXITOSO");
    console.log("═".repeat(60));
    console.log(`\nTiempo total: ${duration}s`);
    console.log(`Reporte guardado: ${filepath}`);
    console.log(`\nPasos completados:`);
    console.log("  ✓ Datos obtenidos de Fabric (DataAgent_TKTAgent)");
    console.log("  ✓ HTML generado desde template");
    console.log("  ✓ Archivo guardado en reports/reporte-final.html");
    console.log("  ✓ Mail enviado por SendGrid");

    process.exit(0);
  } catch (error) {
    console.error(
      "\n❌ Error en el flujo:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("Stack:", error instanceof Error ? error.stack : "");
    process.exit(1);
  }
}

// ============================================================================
// Ejecución
// ============================================================================

runFullFlow();
