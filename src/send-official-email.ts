import "dotenv/config";
import { generateReportHTML, ReportData } from "./templates/report-template.js";
import { sendReport } from "./tools/sendgrid.js";

// Datos mock completos siguiendo la estructura de ReportData
const mockData: ReportData = {
  period: {
    startDate: "2026-06-02",
    endDate: "2026-06-06",
  },

  // Métricas Fila 1 - Estado de Tickets
  totalTickets: 156,
  abiertos: 42,
  cerrados: 89,
  vencidos: 5,
  sinAsignar: 20,
  porcentajeCierre: 57.05,

  // Métricas Fila 2 - Creación por período
  ticketsHoy: 12,
  estaSemana: 48,
  esteMes: 189,

  // Métricas Fila 3 - Tiempos y comparativas
  diasPromedioHastaCerrar: 6480, // ~4.5 días en minutos
  porcentajeCumplimientoSLA: 94.2,
  estaSemanaVsAnterior: {
    creadosPct: 8.5,
    cerradosPct: -2.3,
  },

  // Distribución por Categoría (barras horizontales)
  distribucionCategoria: [
    { categoria: "Soporte Técnico", cantidad: 56 },
    { categoria: "Solicitud de Acceso", cantidad: 38 },
    { categoria: "Reporte de Error", cantidad: 34 },
    { categoria: "Mejora de Sistema", cantidad: 18 },
    { categoria: "Otro", cantidad: 10 },
  ],

  // Tickets por Día de la Semana
  ticketsByDay: [
    { day: "Lunes", count: 28 },
    { day: "Martes", count: 32 },
    { day: "Miércoles", count: 35 },
    { day: "Jueves", count: 30 },
    { day: "Viernes", count: 24 },
    { day: "Sábado", count: 4 },
    { day: "Domingo", count: 3 },
  ],

  // Distribución por Prioridad
  ticketsByPriority: {
    Urgente: 12,
    Alta: 34,
    Media: 78,
    Baja: 32,
  },

  // SLA Compliance
  slaCompliance: {
    compliant: 147,
    exceeded: 9,
  },

  // Distribución por Canal
  distribucionCanal: [
    { canal: "App Tienda", cantidad: 98 },
    { canal: "Teléfono", cantidad: 32 },
    { canal: "Correo", cantidad: 18 },
    { canal: "Chat Web", cantidad: 8 },
  ],

  // Distribución por Tipo
  distribucionTipo: [
    { tipo: "Incidente", cantidad: 78 },
    { tipo: "Requerimiento", cantidad: 56 },
    { tipo: "Mejora", cantidad: 18 },
    { tipo: "Soporte POS", cantidad: 4 },
  ],

  generatedAt: new Date().toISOString(),
};

async function sendOfficialEmail() {
  try {
    const htmlContent = generateReportHTML(mockData);
    const subject = `Reporte de Tickets - Tiendas 3B (${mockData.period.startDate} al ${mockData.period.endDate})`;
    const recipients = ["kgpaz@tiendas3b.com.bo"];

    console.log("🚀 Enviando reporte con plantilla oficial...\n");

    const result = await sendReport(htmlContent, subject, recipients);

    console.log("\n✅ Email enviado correctamente:");
    console.log(`   ${result.message}`);
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

sendOfficialEmail();
