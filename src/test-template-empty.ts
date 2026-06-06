import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { generateReportHTML, ReportData } from "./templates/report-template.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const reportDir = `${__dirname}/../reports`;

/**
 * Datos mock con secciones vacías para probar renderizado condicional
 */
const mockEmptyData: ReportData = {
  period: {
    startDate: "2026-06-02",
    endDate: "2026-06-08",
  },

  // Métricas Fila 1 - Estado
  totalTickets: 500,
  abiertos: 50,
  cerrados: 450,
  vencidos: 5,
  sinAsignar: 0,
  porcentajeCierre: 90,

  // Métricas Fila 2 - Creación por período
  ticketsHoy: 10,
  estaSemana: 50,
  esteMes: 200,

  // Métricas Fila 3 - Tiempos y comparativas
  diasPromedioHastaCerrar: 120,
  porcentajeCumplimientoSLA: 85,
  estaSemanaVsAnterior: {
    creadosPct: 10,
    cerradosPct: 5,
  },

  // Distribución por Categoría - VACÍO
  distribucionCategoria: [],

  // Tickets por Día - TODO CEROS
  ticketsByDay: [
    { day: "Lun", count: 0 },
    { day: "Mar", count: 0 },
    { day: "Mié", count: 0 },
    { day: "Jue", count: 0 },
    { day: "Vie", count: 0 },
    { day: "Sáb", count: 0 },
    { day: "Dom", count: 0 },
  ],

  // Distribución por Prioridad - TODO CEROS
  ticketsByPriority: {
    Urgente: 0,
    Alta: 0,
    Media: 0,
    Baja: 0,
  },

  // SLA Compliance - AMBOS CEROS
  slaCompliance: {
    compliant: 0,
    exceeded: 0,
  },

  // Distribución por Canal - CON DATOS
  distribucionCanal: [{ canal: "Web", cantidad: 500 }],

  // Distribución por Tipo - VACÍO
  distribucionTipo: [],

  generatedAt: new Date().toISOString(),
};

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Test Template Vacío      ║");
  console.log("║  Verificando secciones condicionales       ║");
  console.log("╚════════════════════════════════════════════╝\n");

  try {
    mkdirSync(reportDir, { recursive: true });
    console.log(`✓ Directorio de reportes: ${reportDir}`);

    console.log("\n📝 Generando HTML con datos vacíos...");
    const html = generateReportHTML(mockEmptyData);
    console.log(`✓ HTML generado (${html.length} caracteres)`);

    const filepath = `${reportDir}/reporte-empty-test.html`;
    writeFileSync(filepath, html, "utf-8");
    console.log(`\n✓ Archivo guardado: ${filepath}`);

    // Contar secciones renderizadas
    const sectionMatches = html.match(/<div class="section-title">/g);
    const sectionCount = sectionMatches ? sectionMatches.length : 0;

    console.log("\n✅ Análisis de secciones:");
    console.log(`  • Secciones renderizadas: ${sectionCount}`);
    console.log(`  • Secciones esperadas: 1 (solo Canal tiene datos)`);
    console.log(`\n📋 Verificación:`);
    console.log(
      `  ${
        html.includes("Tickets por Día de la Semana")
          ? "❌"
          : "✓"
      } Día de Semana NO renderizado (todos en 0)`
    );
    console.log(
      `  ${
        html.includes("Distribución por Prioridad")
          ? "❌"
          : "✓"
      } Prioridad NO renderizado (todos en 0)`
    );
    console.log(
      `  ${
        html.includes("Distribución por Categoría")
          ? "❌"
          : "✓"
      } Categoría NO renderizado (vacío)`
    );
    console.log(
      `  ${
        html.includes("Distribución por Canal")
          ? "✓"
          : "❌"
      } Canal renderizado (tiene datos)`
    );
    console.log(
      `  ${
        html.includes("Distribución por Tipo")
          ? "❌"
          : "✓"
      } Tipo NO renderizado (vacío)`
    );
    console.log(
      `  ${
        html.includes("Cumplimiento de SLA")
          ? "❌"
          : "✓"
      } SLA NO renderizado (ambos en 0)`
    );

    process.exit(0);
  } catch (error) {
    console.error(
      `\n❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

main();
