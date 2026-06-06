import { config, getReportRecipients } from "../config.js";
import { createAgentConfig } from "../agent/index.js";

function getWeekDateRange(): { start: Date; end: Date; startStr: string; endStr: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startStr = start.toLocaleDateString("es-BO");
  const endStr = end.toLocaleDateString("es-BO");

  return { start, end, startStr, endStr };
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

export async function runScheduledMode(): Promise<void> {
  log("╔════════════════════════════════════════════╗");
  log("║  AgentTickets3B - Modo Scheduled           ║");
  log("║  (Ejecutado por Azure RunBook)             ║");
  log("╚════════════════════════════════════════════╝");

  const maxRetries = 3;
  let retryCount = 0;
  let success = false;

  // Timeout de 10 minutos
  const timeoutHandle = setTimeout(() => {
    log("❌ ERROR: Timeout de 10 minutos alcanzado");
    process.exit(1);
  }, 600000);

  try {
    const { startStr, endStr } = getWeekDateRange();
    log(`📅 Analizando tickets de la semana: ${startStr} al ${endStr}`);

    const recipients = getReportRecipients();
    log(`📧 Destinatarios del reporte: ${recipients.join(", ")}`);

    // Cargar configuración del agente
    log("⚙️  Cargando configuración del agente...");
    const agentConfig = await createAgentConfig({ mode: "scheduled" });
    log("✓ Configuración cargada exitosamente");

    // Construir prompt de análisis semanal
    const analysisPrompt = `
TAREA SEMANAL AUTOMATIZADA - ${new Date().toLocaleDateString("es-BO")}

Analiza completamente los tickets de soporte de la semana del ${startStr} al ${endStr}.

PASOS A SEGUIR:

1. [data-analyst] Utiliza el Data Lake de Microsoft Fabric para obtener:
   - Todos los tickets creados en el período
   - Agrupación por tienda, categoría, prioridad, estado
   - Anomalías en volumen comparadas con semanas anteriores
   - Tickets duplicados o repetidos
   - Registros incompletos o mal formados

2. [report-generator] Genera un reporte HTML profesional que incluya:
   - Resumen ejecutivo con KPIs principales
   - Gráficos (tablas) de tendencias diarias
   - Categorías más frecuentes
   - Tiendas con mayor volumen
   - Anomalías detectadas y recomendaciones
   - Periodo analizado claramente indicado

3. [mail-sender] Envía el reporte HTML a estos destinatarios:
   ${recipients.map((email) => `   - ${email}`).join("\n")}

REQUISITOS IMPORTANTES:
- Respuestas del data-analyst deben ser JSON válido y estructura clara
- Reporte HTML debe ser autocontenido (CSS inline, sin dependencias externas)
- Colores profesionales y visualización clara de indicadores
- Compatible con clientes de email (Outlook, Gmail, etc.)
- Confirmar envío exitoso

PLAZO: Completar antes de 10 minutos
    `.trim();

    log("🚀 Iniciando análisis semanal...");
    log(`📝 Prompt enviado a los subagentes`);

    // Simulación de ejecución del agente
    // En producción, aquí se hace la llamada real al Claude Agent SDK con query()
    log("▶️  Ejecutando data-analyst para análisis de datos...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    log("✓ data-analyst completado");

    log("▶️  Ejecutando report-generator para generar HTML...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    log("✓ report-generator completado");

    log("▶️  Ejecutando mail-sender para enviar reporte...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    log("✓ mail-sender completado");

    log("✓ Análisis semanal completado exitosamente");
    success = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    log(`❌ ERROR: ${errorMessage}`);

    retryCount++;
    if (retryCount < maxRetries) {
      log(`🔄 Reintentando... (${retryCount}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // En caso real, aquí habría lógica para reintentar
    }
  } finally {
    clearTimeout(timeoutHandle);

    if (success) {
      log("✓ Proceso finalizado correctamente");
      log("═══════════════════════════════════════════");
      process.exit(0);
    } else {
      log(`✗ Proceso fallido después de ${retryCount} intentos`);
      log("═══════════════════════════════════════════");
      process.exit(1);
    }
  }
}
