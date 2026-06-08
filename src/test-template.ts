import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { generateReportHTML, ReportData } from "./templates/report-template.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const reportDir = `${__dirname}/../reports`;

/**
 * Datos mock para previsualización del reporte
 * Basado en estructura real del sistema Gold TKT
 */
const mockReportData: ReportData = {
  period: {
    startDate: "2026-06-02",
    endDate: "2026-06-08",
  },

  // Métricas Fila 1 - Estado
  totalTickets: 1395,
  abiertos: 90,
  cerrados: 1305,
  vencidos: 20,
  sinAsignar: 0,
  porcentajeCierre: (1305 / (90 + 1305)) * 100,

  // Métricas Fila 2 - Creación por período
  ticketsHoy: 19,
  estaSemana: 128,
  esteMes: 487,

  // Métricas Fila 3 - Tiempos y comparativas (158 minutos = ~0.1 días)
  diasPromedioHastaCerrar: 158,
  porcentajeCumplimientoSLA: 82,
  estaSemanaVsAnterior: {
    creadosPct: -41,
    cerradosPct: -39,
  },

  // Distribución por Categoría (barras horizontales)
  distribucionCategoria: [
    { categoria: "POS/Cajas", cantidad: 312 },
    { categoria: "Conectividad", cantidad: 287 },
    { categoria: "Impresoras", cantidad: 198 },
    { categoria: "Servidores", cantidad: 156 },
    { categoria: "Software", cantidad: 134 },
    { categoria: "Hardware", cantidad: 98 },
    { categoria: "Red", cantidad: 87 },
    { categoria: "Otros", cantidad: 123 },
  ],

  // Tickets por Día de la Semana
  ticketsByDay: [
    { day: "Lun", count: 19 },
    { day: "Mar", count: 22 },
    { day: "Mié", count: 28 },
    { day: "Jue", count: 40 },
    { day: "Vie", count: 54 },
    { day: "Sáb", count: 6 },
    { day: "Dom", count: 24 },
  ],

  // Distribución por Prioridad
  ticketsByPriority: {
    Urgente: 322,
    Alta: 601,
    Media: 356,
    Baja: 83,
  },

  // SLA Compliance
  slaCompliance: {
    compliant: 1145,
    exceeded: 250,
  },

  // Distribución por Canal
  distribucionCanal: [
    { canal: "App Tienda", cantidad: 1295 },
    { canal: "Web", cantidad: 100 },
  ],

  // Distribución por Tipo
  distribucionTipo: [
    { tipo: "Soporte", cantidad: 599 },
    { tipo: "POS", cantidad: 211 },
    { tipo: "App Música", cantidad: 127 },
    { tipo: "Impresora POS", cantidad: 94 },
    { tipo: "App Tienda", cantidad: 60 },
    { tipo: "Feature", cantidad: 48 },
    { tipo: "Apoyo", cantidad: 36 },
    { tipo: "Internet", cantidad: 27 },
  ],

  generatedAt: new Date().toISOString(),
};

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Test Template (Nuevo)    ║");
  console.log("║  Generando HTML con nuevo diseño           ║");
  console.log("╚════════════════════════════════════════════╝\n");

  try {
    // Crear directorio de reportes si no existe
    mkdirSync(reportDir, { recursive: true });
    console.log(`✓ Directorio de reportes: ${reportDir}`);

    // Generar HTML
    console.log("\n📝 Generando HTML con nuevo diseño...");
    const html = generateReportHTML(mockReportData);
    console.log(`✓ HTML generado (${html.length} caracteres)`);

    // Guardar archivo
    const filepath = `${reportDir}/report-preview.html`;
    writeFileSync(filepath, html, "utf-8");
    console.log(`\n✓ Archivo guardado: ${filepath}`);

    console.log("\n✅ Reporte generado exitosamente");
    console.log(`\n📊 Datos del reporte:`);
    console.log(`  • Total tickets: ${mockReportData.totalTickets}`);
    console.log(`  • Abiertos: ${mockReportData.abiertos}`);
    console.log(`  • Cerrados: ${mockReportData.cerrados}`);
    console.log(`  • % Cumplimiento SLA: ${mockReportData.porcentajeCumplimientoSLA}%`);
    console.log(`  • Categorías: ${mockReportData.distribucionCategoria.length}`);
    console.log(`  • Canales: ${mockReportData.distribucionCanal.length}`);
    console.log(`  • Tipos: ${mockReportData.distribucionTipo.length}`);

    process.exit(0);
  } catch (error) {
    console.error(
      `\n❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

main();
