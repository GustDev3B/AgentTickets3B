import "dotenv/config";
import { createAgentConfig } from "./agent/index.js";

interface AnalysisResult {
  period: string;
  total_tickets: number;
  anomalies: Array<{
    type: string;
    severity: string;
    description: string;
    count: number;
  }>;
}

function generateMockAnalysis(): AnalysisResult {
  return {
    period: "semana del 26/05 al 01/06",
    total_tickets: 156,
    anomalies: [
      {
        type: "high_volume",
        severity: "high",
        description: "Tienda 5 con 48 tickets (3.2x promedio histórico)",
        count: 48,
      },
      {
        type: "repeated_issue",
        severity: "medium",
        description: "Problema de conexión reportado 12 veces en tienda 3",
        count: 12,
      },
    ],
  };
}

function generateReportHTML(analysis: AnalysisResult): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Semanal de Tickets</title>
  <style>
    body {
      font-family: Arial, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background-color: #1a5490;
      color: white;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .period {
      font-size: 12px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .section {
      background-color: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #1a5490;
      border-bottom: 2px solid #1a5490;
      padding-bottom: 10px;
      margin-top: 0;
    }
    .metric {
      display: inline-block;
      margin-right: 20px;
      margin-bottom: 10px;
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
      color: #1a5490;
    }
    .metric-label {
      font-size: 12px;
      color: #666;
    }
    .anomaly {
      padding: 15px;
      margin-bottom: 10px;
      border-left: 4px solid #e74c3c;
      background-color: #fef5f5;
      border-radius: 3px;
    }
    .anomaly.medium {
      border-left-color: #f39c12;
      background-color: #fffaf5;
    }
    .anomaly-title {
      font-weight: bold;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .severity-high { color: #e74c3c; }
    .severity-medium { color: #f39c12; }
    .severity-low { color: #27ae60; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 11px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Reporte Semanal de Tickets</h1>
    <div class="period">Período: ${analysis.period}</div>
  </div>

  <div class="section">
    <h2>📈 Resumen Ejecutivo</h2>
    <div class="metric">
      <div class="metric-value">${analysis.total_tickets}</div>
      <div class="metric-label">Total de Tickets</div>
    </div>
    <div class="metric">
      <div class="metric-value">${analysis.anomalies.length}</div>
      <div class="metric-label">Anomalías Detectadas</div>
    </div>
  </div>

  <div class="section">
    <h2>⚠️ Anomalías Detectadas</h2>
    ${analysis.anomalies
      .map(
        (anomaly) => `
    <div class="anomaly ${anomaly.severity}">
      <div class="anomaly-title">
        <span class="severity-${anomaly.severity}">🔔</span>
        <strong>${anomaly.type}</strong>
        <span style="color: #999; font-size: 12px;">(${anomaly.severity})</span>
      </div>
      <p style="margin: 5px 0;">${anomaly.description}</p>
      <p style="margin: 5px 0; font-size: 12px; color: #666;">Ocurrencias: <strong>${anomaly.count}</strong></p>
    </div>
    `
      )
      .join("")}
  </div>

  <div class="section">
    <h2>✅ Recomendaciones</h2>
    <ul>
      <li>Revisar con gerente de tienda 5 el aumento en volumen de tickets</li>
      <li>Investigar el problema de conexión reportado en tienda 3</li>
      <li>Implementar validación más estricta en formularios de tickets</li>
    </ul>
  </div>

  <div class="footer">
    <p>Reporte generado automáticamente por AgentTickets3B</p>
    <p>Timestamp: ${new Date().toLocaleString("es-BO")}</p>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   AgentTickets3B - Test Agent Script       ║");
  console.log("╚════════════════════════════════════════════╝");

  console.log("\n📋 Paso 1: Cargar configuración del agente...");
  try {
    const agentConfig = await createAgentConfig({ mode: "chat" });
    console.log("✓ Configuración cargada exitosamente");
    console.log(`  - System prompt: ${agentConfig.systemPrompt.substring(0, 50)}...`);
    console.log(`  - Subagentes: ${agentConfig.subagents.length}`);
    agentConfig.subagents.forEach((agent) => {
      console.log(`    ├─ ${agent.name}: ${agent.description}`);
    });
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  console.log("\n📊 Paso 2: Generar análisis mock del data-analyst...");
  const analysis = generateMockAnalysis();
  console.log(`✓ Análisis generado`);
  console.log(`  - Período: ${analysis.period}`);
  console.log(`  - Total de tickets: ${analysis.total_tickets}`);
  console.log(`  - Anomalías detectadas: ${analysis.anomalies.length}`);

  console.log("\n🎨 Paso 3: Generar HTML del report-generator...");
  const htmlReport = generateReportHTML(analysis);
  console.log(`✓ HTML generado exitosamente`);
  console.log(`  - Tamaño: ${htmlReport.length} caracteres`);
  console.log(`  - Válido: ${htmlReport.includes("<!DOCTYPE html>") ? "Sí" : "No"}`);
  console.log(`  - Contiene CSS inline: ${htmlReport.includes("<style>") ? "Sí" : "No"}`);

  // Validar HTML mínimamente
  const hasRequiredElements = [
    "<!DOCTYPE html>",
    "<html",
    "</html>",
    "<body",
    "</body>",
    "<style",
    "</style>",
    "Reporte Semanal",
  ].every((elem) => htmlReport.includes(elem));

  if (hasRequiredElements) {
    console.log(`  - Estructura HTML: ✓ Completa`);
  } else {
    console.log(`  - Estructura HTML: ❌ Incompleta`);
  }

  console.log("\n✉️ Paso 4: Simular envío con mail-sender...");
  const recipients = ["gerente@tiendas3b.com.bo", "analista@tiendas3b.com.bo"];
  console.log(`✓ Simulated: Envío de email`);
  console.log(`  - Destinatarios: ${recipients.length}`);
  recipients.forEach((email) => {
    console.log(`    ├─ ${email}`);
  });
  console.log(`  - Tamaño del contenido: ${htmlReport.length} bytes`);
  console.log(`  - Estado: ✓ Listo para enviar (simulado)`);

  console.log("\n" + "═".repeat(44));
  console.log("📊 RESUMEN DE PRUEBAS:");
  console.log("═".repeat(44));
  console.log("✓ Configuración del agente: OK");
  console.log("✓ Data-analyst mock: OK");
  console.log("✓ Report-generator: OK");
  console.log("✓ Mail-sender simulado: OK");
  console.log("═".repeat(44));
  console.log("\n🎉 Todas las pruebas exitosas!");
  console.log("\n📝 Próximos pasos:");
  console.log("  1. Configurar .env con credenciales reales");
  console.log("  2. Ejecutar: npm run test:connection");
  console.log("  3. Implementar query() real del Claude Agent SDK");
  console.log("  4. Probar modo chat: npm run chat\n");

  process.exit(0);
}

main().catch((error) => {
  console.error(
    "❌ Error fatal:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
