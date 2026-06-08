import Anthropic from "@anthropic-ai/sdk";
import { getReportRecipients, config } from "../config.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { sendReport } from "../tools/sendgrid.js";
import { createQueryOptions } from "../agent/index.js";
import {
  generateHTMLFromFabricData,
  type FabricData,
} from "../templates/report-template.js";

interface Hallazgo {
  titulo: string;
  detalle: string;
  severidad: "alta" | "media" | "baja";
}

interface AnalisisData {
  hallazgos: Hallazgo[];
  recomendaciones: string[];
}

function getWeekDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const toISO = (d: Date) => d.toISOString().split("T")[0];

  return {
    startStr: start.toLocaleDateString("es-BO"),
    endStr: end.toLocaleDateString("es-BO"),
    startISO: toISO(start),
    endISO: toISO(end),
  };
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function toNumber(val: unknown): number {
  return Number(val) || 0;
}

function toStringArray<T extends Record<string, unknown>>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "N/A";
  const days = minutes / 1440;
  if (days >= 1) return `${days.toFixed(1)} días`;
  return `${(minutes / 60).toFixed(1)} hrs`;
}

function extractJSON(text: string): Record<string, unknown> | null {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try {
      const parsed: unknown = JSON.parse(codeBlock[1].trim());
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    } catch { /* fall through */ }
  }
  const bare = text.match(/\{[\s\S]*\}/);
  if (bare) {
    try {
      const parsed: unknown = JSON.parse(bare[0]);
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    } catch { /* fall through */ }
  }
  return null;
}

function parseFabricData(resultText: string): FabricData {
  log(`📄 Respuesta del agente (primeros 800 chars):\n${resultText.substring(0, 800)}`);

  const raw = extractJSON(resultText) ?? {};

  const totalTickets = toNumber(raw.totalTickets);
  const cerrados = toNumber(raw.cerrados);
  const slaCompliant = toNumber(raw.slaCompliant);
  const slaExceeded = toNumber(raw.slaExceeded);
  const slaTotal = slaCompliant + slaExceeded;

  const mapNombre = (arr: unknown) =>
    toStringArray<Record<string, unknown>>(arr).map(item => ({
      nombre: String(item.nombre ?? ""),
      cantidad: toNumber(item.cantidad),
    }));

  return {
    totalTickets,
    abiertos: toNumber(raw.abiertos),
    cerrados,
    vencidos: toNumber(raw.vencidos),
    sinAsignar: toNumber(raw.sinAsignar),
    porcentajeCierre: totalTickets > 0 ? (cerrados / totalTickets) * 100 : 0,
    ticketsHoy: toNumber(raw.ticketsHoy),
    estaSemana: toNumber(raw.estaSemana),
    esteMes: toNumber(raw.esteMes),
    diasPromedioHastaCerrar: formatMinutes(toNumber(raw.diasPromedioMinutos)),
    porcentajeCumplimientoSLA: slaTotal > 0
      ? (slaCompliant / slaTotal) * 100
      : toNumber(raw.porcentajeCumplimientoSLA),
    creadosPct: toNumber(raw.creadosPct),
    cerradosPct: toNumber(raw.cerradosPct),
    distribucionCategoria: mapNombre(raw.distribucionCategoria),
    slaCompliant,
    slaExceeded,
    distribucionCanal: mapNombre(raw.distribucionCanal),
    distribucionTipo: mapNombre(raw.distribucionTipo),
  };
}

async function analyzeReportData(data: FabricData): Promise<AnalisisData> {
  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  const prompt = `Eres un analista de soporte técnico para Tiendas 3B. Analiza ÚNICAMENTE los siguientes datos del reporte semanal y genera hallazgos y recomendaciones.

DATOS DEL REPORTE:
${JSON.stringify(data, null, 2)}

Responde ÚNICAMENTE con un JSON válido con esta estructura (sin texto adicional):

{
  "hallazgos": [
    {"titulo": "Titulo corto del hallazgo", "detalle": "Explicación basada en los números del reporte", "severidad": "alta"}
  ],
  "recomendaciones": [
    "Acción concreta basada en los datos del reporte"
  ]
}

Reglas:
- hallazgos: máximo 5, basados SOLO en los números del JSON de arriba
- severidad: "alta" (acción inmediata), "media" (monitorear), "baja" (informativo)
- recomendaciones: máximo 4, concretas y accionables
- NO inventes datos que no estén en el JSON`;

  const response = await client.messages.create({
    model: config.LLM_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const raw = extractJSON(text) ?? {};

  const hallazgos: Hallazgo[] = toStringArray<Record<string, unknown>>(raw.hallazgos)
    .map(h => ({
      titulo: String(h.titulo ?? ""),
      detalle: String(h.detalle ?? ""),
      severidad: (["alta", "media", "baja"].includes(String(h.severidad)) ? h.severidad : "baja") as Hallazgo["severidad"],
    }))
    .filter(h => h.titulo.length > 0);

  const recomendaciones: string[] = (Array.isArray(raw.recomendaciones) ? raw.recomendaciones as unknown[] : [])
    .map(r => String(r))
    .filter(r => r.length > 0);

  return { hallazgos, recomendaciones };
}

function generateAnalysisHTML(analisis: AnalisisData): string {
  if (analisis.hallazgos.length === 0 && analisis.recomendaciones.length === 0) return "";

  const severidadColor: Record<Hallazgo["severidad"], string> = {
    alta: "#e74c3c",
    media: "#ed712a",
    baja: "#27ae60",
  };

  const severidadLabel: Record<Hallazgo["severidad"], string> = {
    alta: "ALTA",
    media: "MEDIA",
    baja: "BAJA",
  };

  const hallazgosHTML = analisis.hallazgos.map(h => {
    const color = severidadColor[h.severidad];
    const label = severidadLabel[h.severidad];
    return `<tr>
          <td style="padding:0 0 12px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="border-left:4px solid ${color};background-color:#fafafa;border-radius:0 4px 4px 0;">
              <tr>
                <td style="padding:12px 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#1a1a1a;padding-bottom:4px;">
                        ${h.titulo}
                        <span style="font-size:10px;font-weight:bold;color:${color};margin-left:8px;text-transform:uppercase;">[${label}]</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555555;line-height:18px;">
                        ${h.detalle}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
  }).join("");

  const recomendacionesHTML = analisis.recomendaciones.map((r, i) =>
    `<tr>
          <td style="padding:0 0 8px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="28" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#ed712a;padding-top:1px;">${i + 1}.</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;line-height:18px;">${r}</td>
              </tr>
            </table>
          </td>
        </tr>`
  ).join("");

  return `
        <tr>
          <td style="padding:35px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid #f0f0f0;padding-top:25px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#1a1a1a;padding-bottom:20px;">
                  Análisis Inteligente
                </div>
                ${analisis.hallazgos.length > 0 ? `
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#666666;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:12px;">Hallazgos</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${hallazgosHTML}
                </table>` : ""}
                ${analisis.recomendaciones.length > 0 ? `
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#666666;text-transform:uppercase;letter-spacing:0.5px;padding:20px 0 12px 0;">Recomendaciones</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${recomendacionesHTML}
                </table>` : ""}
              </td></tr>
            </table>
          </td>
        </tr>`;
}

function injectAnalysisIntoHTML(reportHTML: string, analisisHTML: string): string {
  if (!analisisHTML) return reportHTML;
  const insertBefore = `<tr><td style="height:30px;line-height:30px;font-size:1px;">&nbsp;</td></tr>`;
  return reportHTML.includes(insertBefore)
    ? reportHTML.replace(insertBefore, `${analisisHTML}\n        ${insertBefore}`)
    : reportHTML.replace("</table>\n</body>", `${analisisHTML}\n      </table>\n</body>`);
}

export async function runScheduledMode(): Promise<void> {
  log("╔════════════════════════════════════════════╗");
  log("║  AgentTickets3B - Modo Scheduled           ║");
  log("╚════════════════════════════════════════════╝");

  let success = false;

  const timeoutHandle = setTimeout(() => {
    log("❌ ERROR: Timeout de 10 minutos alcanzado");
    process.exit(1);
  }, 600000);

  try {
    const { startStr, endStr } = getWeekDateRange();
    log(`📅 Analizando tickets de la semana: ${startStr} al ${endStr}`);

    const recipients = getReportRecipients();
    log(`📧 Destinatarios: ${recipients.join(", ")}`);

    // PASO 1 — Agent SDK consulta Fabric y devuelve datos estructurados
    const dataPrompt = `
Analiza los tickets de soporte de la semana del ${startStr} al ${endStr} usando el DataAgent_TKTAgent de Fabric.

Consulta los datos necesarios y responde ÚNICAMENTE con un JSON válido con esta estructura (sin texto adicional, sin markdown):

{
  "totalTickets": 0,
  "abiertos": 0,
  "cerrados": 0,
  "vencidos": 0,
  "sinAsignar": 0,
  "ticketsHoy": 0,
  "estaSemana": 0,
  "esteMes": 0,
  "diasPromedioMinutos": 0,
  "porcentajeCumplimientoSLA": 0,
  "creadosPct": 0,
  "cerradosPct": 0,
  "distribucionCategoria": [{"nombre": "NombreCategoria", "cantidad": 0}],
  "distribucionCanal": [{"nombre": "NombreCanal", "cantidad": 0}],
  "distribucionTipo": [{"nombre": "NombreTipo", "cantidad": 0}],
  "slaCompliant": 0,
  "slaExceeded": 0
}

Notas:
- diasPromedioMinutos: promedio de DuracionMinutos de tickets cerrados (entero)
- vencidos: tickets con EsCerrado=0 y alta antigüedad
- sinAsignar: tickets sin NombreGrupo asignado
- slaCompliant / slaExceeded: tickets dentro y fuera del tiempo esperado
- creadosPct / cerradosPct: cambio porcentual vs semana anterior (puede ser negativo)
`.trim();

    log("🚀 Paso 1: Obteniendo datos de Fabric...");
    const options = await createQueryOptions("scheduled");
    const stream = query({ prompt: dataPrompt, options });

    let finalResult = "";
    let lastAssistantText = "";

    for await (const message of stream) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            lastAssistantText = block.text;
          } else if (block.type === "tool_use") {
            log(`  🔧 Tool call: ${block.name}`);
          }
        }
      } else if (message.type === "result") {
        if (message.subtype === "success") {
          finalResult = message.result;
          log(`✓ Datos obtenidos (${message.num_turns} turnos)`);
        } else {
          throw new Error(`Agent error: ${message.subtype}`);
        }
      }
    }

    const resultText = finalResult || lastAssistantText;
    if (!resultText) throw new Error("El agente no devolvió ningún resultado");

    const fabricData = parseFabricData(resultText);
    log(`  📊 Total: ${fabricData.totalTickets}, Abiertos: ${fabricData.abiertos}, Cerrados: ${fabricData.cerrados}`);

    // PASO 2 — Anthropic SDK analiza solo los datos del reporte
    log("🧠 Paso 2: Analizando datos del reporte...");
    const analisis = await analyzeReportData(fabricData);
    log(`  🔍 Hallazgos: ${analisis.hallazgos.length}, Recomendaciones: ${analisis.recomendaciones.length}`);

    // PASO 3 — Generar HTML y enviar
    log("🎨 Paso 3: Generando HTML...");
    const reportHTML = generateHTMLFromFabricData(fabricData);
    const analisisHTML = generateAnalysisHTML(analisis);
    const html = injectAnalysisIntoHTML(reportHTML, analisisHTML);
    log(`  ✓ HTML generado (${html.length} chars)`);

    const subject = `📊 Reporte Semanal de Tickets - Tiendas 3B (${startStr})`;
    await sendReport(html, subject, recipients);
    log("✓ Email enviado exitosamente");

    success = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`❌ ERROR: ${errorMessage}`);
  } finally {
    clearTimeout(timeoutHandle);
    if (success) {
      log("✓ Proceso finalizado correctamente");
      log("═══════════════════════════════════════════");
      process.exit(0);
    } else {
      log("✗ Proceso fallido");
      log("═══════════════════════════════════════════");
      process.exit(1);
    }
  }
}
