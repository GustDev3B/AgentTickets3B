import "dotenv/config";
import { sendReport } from "./tools/sendgrid.js";

// Datos mock para prueba
const mockReportData = {
  period: "Semana del 2 al 6 de junio de 2026",
  totalTickets: 156,
  closedTickets: 89,
  openTickets: 42,
  pendingTickets: 25,
  averageResolutionTime: "4.5 días",
  topIssues: [
    { issue: "Problemas de conexión POS", count: 23 },
    { issue: "Solicitudes de acceso", count: 18 },
    { issue: "Reportes de sistema lento", count: 15 },
  ],
  priorityBreakdown: {
    critical: 2,
    urgent: 12,
    high: 34,
    medium: 78,
    low: 30,
  },
  topStores: [
    { store: "Tienda 001 - La Paz", tickets: 24 },
    { store: "Tienda 015 - Cochabamba", tickets: 19 },
    { store: "Tienda 008 - Santa Cruz", tickets: 16 },
  ],
};

// Generar HTML simple pero profesional
function generateHTML(): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte de Tickets - Tiendas 3B</title>
      <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .section { margin: 20px 0; }
        .section h2 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .metric { display: inline-block; width: 23%; margin: 1%; padding: 15px; background: #f5f5f5; border-radius: 4px; text-align: center; }
        .metric .number { font-size: 24px; font-weight: bold; color: #667eea; }
        .metric .label { font-size: 12px; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        table th { background: #667eea; color: white; padding: 12px; text-align: left; }
        table td { padding: 10px; border-bottom: 1px solid #ddd; }
        table tr:nth-child(even) { background: #f9f9f9; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Reporte de Tickets</h1>
          <p>Sistema de Análisis - Tiendas 3B</p>
        </div>

        <div class="section">
          <h2>Resumen del Período</h2>
          <p>${mockReportData.period}</p>
          <div>
            <div class="metric">
              <div class="number">${mockReportData.totalTickets}</div>
              <div class="label">Total de Tickets</div>
            </div>
            <div class="metric">
              <div class="number">${mockReportData.closedTickets}</div>
              <div class="label">Cerrados</div>
            </div>
            <div class="metric">
              <div class="number">${mockReportData.openTickets}</div>
              <div class="label">Abiertos</div>
            </div>
            <div class="metric">
              <div class="number">${mockReportData.pendingTickets}</div>
              <div class="label">Pendientes</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Métricas Clave</h2>
          <table>
            <tr>
              <th>Métrica</th>
              <th>Valor</th>
            </tr>
            <tr>
              <td>Tiempo promedio de resolución</td>
              <td>${mockReportData.averageResolutionTime}</td>
            </tr>
            <tr>
              <td>Tasa de cierre</td>
              <td>${Math.round((mockReportData.closedTickets / mockReportData.totalTickets) * 100)}%</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>Top 3 Problemas Reportados</h2>
          <table>
            <tr>
              <th>Problema</th>
              <th>Cantidad</th>
            </tr>
            ${mockReportData.topIssues
              .map(
                (issue) => `
            <tr>
              <td>${issue.issue}</td>
              <td>${issue.count}</td>
            </tr>
            `
              )
              .join("")}
          </table>
        </div>

        <div class="section">
          <h2>Distribución por Prioridad</h2>
          <table>
            <tr>
              <th>Prioridad</th>
              <th>Cantidad</th>
            </tr>
            <tr>
              <td>🔴 Crítica</td>
              <td>${mockReportData.priorityBreakdown.critical}</td>
            </tr>
            <tr>
              <td>🟠 Urgente</td>
              <td>${mockReportData.priorityBreakdown.urgent}</td>
            </tr>
            <tr>
              <td>🟡 Alta</td>
              <td>${mockReportData.priorityBreakdown.high}</td>
            </tr>
            <tr>
              <td>🟢 Media</td>
              <td>${mockReportData.priorityBreakdown.medium}</td>
            </tr>
            <tr>
              <td>🔵 Baja</td>
              <td>${mockReportData.priorityBreakdown.low}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>Top 3 Tiendas por Tickets</h2>
          <table>
            <tr>
              <th>Tienda</th>
              <th>Tickets</th>
            </tr>
            ${mockReportData.topStores
              .map(
                (store) => `
            <tr>
              <td>${store.store}</td>
              <td>${store.tickets}</td>
            </tr>
            `
              )
              .join("")}
          </table>
        </div>

        <div class="footer">
          <p>Este reporte fue generado automáticamente por AgentTickets3B</p>
          <p>© 2026 Tiendas 3B - Todos los derechos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendTestEmail() {
  try {
    const htmlContent = generateHTML();
    const subject = `📊 Reporte de Tickets - ${mockReportData.period}`;
    const recipients = ["kgpaz@tiendas3b.com.bo"];

    console.log("🚀 Iniciando envío de correo de prueba...\n");

    const result = await sendReport(htmlContent, subject, recipients);

    console.log("\n✅ Resultado:");
    console.log(`   Éxito: ${result.success}`);
    console.log(`   Mensaje: ${result.message}`);
    console.log(`   Destinatarios: ${result.recipientCount}`);
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

sendTestEmail();
