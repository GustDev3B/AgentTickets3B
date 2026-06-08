import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { config, getReportRecipients } from "./config.js";
import { FabricMcpClient } from "./tools/fabric.js";
import { sendReport } from "./tools/sendgrid.js";
import { getCachedAccessToken } from "./auth/azure.js";

const reportDir = "reports";
mkdirSync(reportDir, { recursive: true });

// Datos que extrae de Fabric
interface FabricData {
  totalTickets: number;
  abiertos: number;
  cerrados: number;
  vencidos: number;
  sinAsignar: number;
  porcentajeCierre: number;
  ticketsHoy: number;
  estaSemana: number;
  esteMes: number;
  diasPromedioHastaCerrar: string;
  porcentajeCumplimientoSLA: number;
  creadosPct: number;
  cerradosPct: number;
  distribucionCategoria: Array<{ nombre: string; cantidad: number }>;
  slaCompliant: number;
  slaExceeded: number;
  distribucionCanal: Array<{ nombre: string; cantidad: number }>;
  distribucionTipo: Array<{ nombre: string; cantidad: number }>;
}

async function fetchFabricData(): Promise<FabricData> {
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
    { key: "estado", q: "Dame estos 5 números exactos en orden: total de tickets, abiertos, cerrados, vencidos, sin asignar. Responde solo: número,número,número,número,número" },
    { key: "creacion", q: "¿Cuántos tickets en estos períodos? Hoy: X, Esta Semana: Y, Este Mes: Z. Responde: X,Y,Z" },
    { key: "tiempos", q: "¿Tiempo promedio en horas y % cumplimiento SLA? Dame: 12.5,85.5 (sin unidades)" },
    { key: "comparativa", q: "Porcentaje cambio creados y cerrados esta semana vs anterior. Dame: +5,-10 (con signo)" },
    { key: "categoria", q: "¿Cuál es la distribución de tickets por categoría? Formato: - Nombre: cantidad" },
    { key: "sla", q: "¿Cuántos tickets cumplen SLA y cuántos no cumplen? Formato: - Dentro: número, - Fuera: número" },
    { key: "canal", q: "¿Cuál es la distribución de tickets por canal de origen? Formato: - Canal: cantidad" },
    { key: "tipo", q: "¿Cuál es la distribución de tickets por tipo? Formato: - Tipo: cantidad" },
  ];

  const responses: { [key: string]: string } = {};

  for (const item of questions) {
    console.log(`⏳ ${item.key}...`);
    try {
      if (fabricClient) {
        responses[item.key] = await fabricClient.query(item.q);
      } else {
        // Usar fallback OpenAI-compatible
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

  // Parsers mejorados
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
      // Busca patrón: - Nombre: número o Nombre: número
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

  // Estado: total, abiertos, cerrados, vencidos, sin asignar
  const estadoNums = extractNumbers(responses["estado"]);
  const total = Math.max(estadoNums[0] || 0, 1); // Evitar división por 0
  const abiertos = estadoNums[1] || 0;
  const cerrados = Math.min(estadoNums[2] || 0, total); // No puede ser más que el total
  const vencidos = estadoNums[3] || 0;
  const sinAsignar = estadoNums[4] || 0;

  // Creación: hoy, esta semana, este mes
  const creacionNums = extractNumbers(responses["creacion"]);
  const ticketsHoy = creacionNums[0] || 0;
  const estaSemana = creacionNums[1] || 0;
  const esteMes = creacionNums[2] || 0;

  // Tiempos: promedio (horas), SLA %
  const tiemposNums = extractNumbers(responses["tiempos"]);
  const diasPromedioHastaCerrar = tiemposNums[0] ? `${tiemposNums[0].toFixed(1)} horas` : "0 hrs";
  const slaPercent = Math.min(tiemposNums[1] || 0, 100); // SLA no puede exceder 100%

  // Comparativa: cambio creados %, cambio cerrados %
  const comparativaNums = extractNumbers(responses["comparativa"]);
  const creadosPctChange = Math.min(comparativaNums[0] || 0, 100);
  const cerradosPctChange = Math.min(comparativaNums[1] || 0, 100);

  // SLA: dentro, fuera
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
  return data;
}

function generateHTMLFromStructure(data: FabricData): string {
  console.log("\n📄 PASO 2: Regenerando HTML con estructura de report-preview");
  console.log("═".repeat(60));

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")} de ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][today.getMonth()]} del ${today.getFullYear()}`;

  // Función para generar fila de distribución
  const generateDistributionRow = (nombre: string, cantidad: number, maxQty: number, porcentaje: number) => {
    const barWidth = (cantidad / maxQty) * 100;
    return `<!-- ${nombre} ${cantidad} - ${Math.round(barWidth)}% -->
                  <tr>
                    <td class="bar-label" width="130" valign="middle" style="font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#333333; font-weight:bold; padding:5px 10px 5px 0;">${nombre}</td>
                    <td valign="middle" style="padding:5px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0" style="background-color:#f0f0f0; border-radius:3px;">
                        <tr><td><table role="presentation" width="${barWidth}%" cellpadding="0" cellspacing="0" border="0"><tr>
                          <td bgcolor="#ed712a" align="right" style="background-color:#ed712a; border-radius:3px; height:22px; line-height:22px; mso-line-height-rule:exactly; padding:0 6px; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:10px; font-weight:bold; white-space:nowrap;">${cantidad}</td>
                        </tr></table></td></tr>
                      </table>
                    </td>
                    <td width="48" valign="middle" align="right" style="font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#666666; padding:5px 0 5px 8px;">${porcentaje.toFixed(1)}%</td>
                  </tr>`;
  };

  const maxCategory = Math.max(...data.distribucionCategoria.map(c => c.cantidad), 1);
  const categoriaRows = data.distribucionCategoria
    .map(cat => generateDistributionRow(cat.nombre, cat.cantidad, maxCategory, (cat.cantidad / data.totalTickets) * 100))
    .join("\n");

  const maxCanal = Math.max(...data.distribucionCanal.map(c => c.cantidad), 1);
  const canalRows = data.distribucionCanal
    .map(canal => generateDistributionRow(canal.nombre, canal.cantidad, maxCanal, (canal.cantidad / data.totalTickets) * 100))
    .join("\n");

  const maxTipo = Math.max(...data.distribucionTipo.map(t => t.cantidad), 1);
  const tipoRows = data.distribucionTipo
    .map(tipo => generateDistributionRow(tipo.nombre, tipo.cantidad, maxTipo, (tipo.cantidad / data.totalTickets) * 100))
    .join("\n");

  const slaTotal = data.slaCompliant + data.slaExceeded;
  const slaCompliantPct = slaTotal > 0 ? (data.slaCompliant / slaTotal) * 100 : 0;
  const slaExceededPct = 100 - slaCompliantPct;

  // HTML base con estructura de report-preview
  const html = `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Reporte de Tickets - Tiendas 3B</title>
  <style>
    body, table, td { margin: 0; padding: 0; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    body { width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .kpi-cell { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 0 0 8px 0 !important; }
      .bar-label { width: 110px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, Helvetica, sans-serif; color:#333333;">
  <div style="display:none; font-size:1px; color:#f4f4f4; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Reporte de Tickets - Tiendas 3B &mdash; ${dateStr}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4" style="background-color:#f4f4f4;">
    <tr><td align="center" style="padding:20px 10px;">
      <table role="presentation" class="email-container" width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:640px; max-width:640px; background-color:#ffffff;">
        <!-- HEADER -->
        <tr>
          <td bgcolor="#ed712a" align="center" style="background-color:#ed712a; padding:30px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-size:28px; font-weight:bold; line-height:32px; padding-bottom:8px;">
                  Reporte de Tickets - Tiendas 3B
                </td>
              </tr>
              <tr>
                <td align="center" style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-size:14px; line-height:18px;">
                  ${dateStr}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- KPI FILA 1 -->
        <tr>
          <td style="padding:15px 20px 0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="kpi-cell" valign="top" width="16.66%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Total</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.totalTickets}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="16.66%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Abiertos</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#3498db;">${data.abiertos}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="16.66%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Cerrados</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#27ae60;">${data.cerrados}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="16.66%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Vencidos</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#e74c3c;">${data.vencidos}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="16.66%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Sin Asignar</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.sinAsignar}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="16.66%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">% Cierre</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.porcentajeCierre.toFixed(1)}%</div></td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- KPI FILA 2 -->
        <tr>
          <td style="padding:12px 20px 0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="kpi-cell" valign="top" width="33.33%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Tickets Hoy</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.ticketsHoy}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="33.33%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Esta Semana</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.estaSemana}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="33.33%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">Este Mes</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.esteMes}</div></td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- KPI FILA 3 -->
        <tr>
          <td style="padding:12px 20px 0 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="kpi-cell" valign="top" width="33.33%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">D&iacute;as Promedio Hasta Cerrar</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#1a1a1a;">${data.diasPromedioHastaCerrar}</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="33.33%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:6px;">% Cumplimiento SLA</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:24px; font-weight:bold; color:#ed712a;">${data.porcentajeCumplimientoSLA.toFixed(1)}%</div></td></tr>
                  </table>
                </td>
                <td class="kpi-cell" valign="top" width="33.33%" style="padding:0 3px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0; border-radius:4px;">
                    <tr><td style="padding:12px;"><div style="font-family:Arial, Helvetica, sans-serif; font-size:10px; color:#999999; text-transform:uppercase; letter-spacing:0.5px; font-weight:bold; padding-bottom:8px;">Esta Semana vs Anterior</div><div style="font-family:Arial, Helvetica, sans-serif; font-size:11px; color:#333333; font-weight:bold; padding-bottom:4px;">Creados: <span style="color:#e74c3c;">${data.creadosPct > 0 ? '+' : ''}${data.creadosPct}%</span></div><div style="font-family:Arial, Helvetica, sans-serif; font-size:11px; color:#333333; font-weight:bold;">Cerrados: <span style="color:#e74c3c;">${data.cerradosPct > 0 ? '+' : ''}${data.cerradosPct}%</span></div></td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- DISTRIBUCION POR CATEGORIA -->
        <tr>
          <td style="padding:35px 24px 0 24px;">
            <div style="border-top:1px solid #f0f0f0; padding-top:25px;">
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#1a1a1a; padding-bottom:20px;">Distribuci&oacute;n por Categor&iacute;a</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${categoriaRows}
              </table>
            </div>
          </td>
        </tr>

        <!-- DISTRIBUCION POR CANAL -->
        <tr>
          <td style="padding:35px 24px 0 24px;">
            <div style="border-top:1px solid #f0f0f0; padding-top:25px;">
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#1a1a1a; padding-bottom:20px;">Distribuci&oacute;n por Canal</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${canalRows}
              </table>
            </div>
          </td>
        </tr>

        <!-- DISTRIBUCION POR TIPO -->
        <tr>
          <td style="padding:35px 24px 0 24px;">
            <div style="border-top:1px solid #f0f0f0; padding-top:25px;">
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#1a1a1a; padding-bottom:20px;">Distribuci&oacute;n por Tipo</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${tipoRows}
              </table>
            </div>
          </td>
        </tr>

        <!-- CUMPLIMIENTO DE SLA -->
        <tr>
          <td style="padding:35px 24px 0 24px;">
            <div style="border-top:1px solid #f0f0f0; padding-top:25px;">
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#1a1a1a; padding-bottom:20px;">Cumplimiento de SLA</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:4px; overflow:hidden;">
                <tr>
                  <td bgcolor="#27ae60" width="${slaCompliantPct}%" align="center" style="background-color:#27ae60; height:30px; line-height:30px; mso-line-height-rule:exactly; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:bold;">${slaCompliantPct.toFixed(1)}%</td>
                  <td bgcolor="#e74c3c" width="${slaExceededPct}%" align="center" style="background-color:#e74c3c; height:30px; line-height:30px; mso-line-height-rule:exactly; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:bold;">${slaExceededPct.toFixed(1)}%</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:18px;">
                <tr>
                  <td valign="top" width="50%" style="padding:6px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td width="24" valign="middle" style="padding-right:12px;">
                        <table role="presentation" width="20" height="20" cellpadding="0" cellspacing="0" border="0" bgcolor="#27ae60" style="background-color:#27ae60; border-radius:3px;"><tr><td style="height:20px; line-height:20px; font-size:1px;">&nbsp;</td></tr></table>
                      </td>
                      <td valign="middle" style="font-family:Arial, Helvetica, sans-serif;">
                        <div style="font-size:13px; font-weight:bold; color:#27ae60;">Dentro de SLA</div>
                        <div style="font-size:16px; font-weight:bold; color:#1a1a1a;">${data.slaCompliant}</div>
                      </td>
                    </tr></table>
                  </td>
                  <td valign="top" width="50%" style="padding:6px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td width="24" valign="middle" style="padding-right:12px;">
                        <table role="presentation" width="20" height="20" cellpadding="0" cellspacing="0" border="0" bgcolor="#e74c3c" style="background-color:#e74c3c; border-radius:3px;"><tr><td style="height:20px; line-height:20px; font-size:1px;">&nbsp;</td></tr></table>
                      </td>
                      <td valign="middle" style="font-family:Arial, Helvetica, sans-serif;">
                        <div style="font-size:13px; font-weight:bold; color:#e74c3c;">Fuera de SLA</div>
                        <div style="font-size:16px; font-weight:bold; color:#1a1a1a;">${data.slaExceeded}</div>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <tr><td style="height:30px; line-height:30px; font-size:1px;">&nbsp;</td></tr>

        <!-- FOOTER -->
        <tr>
          <td bgcolor="#ed712a" align="center" style="background-color:#ed712a; padding:20px 24px; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:12px;">
            <div style="font-weight:bold; margin-bottom:4px; font-size:14px;">Reporte Automático - Tiendas 3B</div>
            <div style="margin-top:4px; opacity:0.9; font-size:10px;">Sistema de Análisis de Tickets</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  console.log(`✓ HTML regenerado (${html.length} caracteres)`);
  return html;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Regenerar HTML con Estructura Outlook   ║");
  console.log("║  Fabric (datos) → HTML (estructura report-preview)      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const startTime = Date.now();

  try {
    const data = await fetchFabricData();
    const html = generateHTMLFromStructure(data);

    console.log("\n💾 PASO 3: Guardando report-official.html");
    console.log("═".repeat(60));
    const filepath = `${reportDir}/report-official.html`;
    writeFileSync(filepath, html, "utf-8");
    console.log(`✓ Reporte guardado en: ${filepath}\n`);

    console.log("📧 PASO 4: Enviando por email");
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
