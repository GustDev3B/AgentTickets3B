/**
 * Template para generar reportes HTML de tickets
 * Color corporativo: #ed712a (naranja Tiendas 3B)
 * Diseño basado en imagen de referencia
 */

export interface ReportData {
  period: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
  };

  // Métricas Fila 1 - Estado de Tickets
  totalTickets: number;
  abiertos: number;
  cerrados: number;
  vencidos: number;           // SLA excedido
  sinAsignar: number;         // Sin grupo
  porcentajeCierre: number;   // cerrados/total * 100

  // Métricas Fila 2 - Creación por período
  ticketsHoy: number;
  estaSemana: number;
  esteMes: number;

  // Métricas Fila 3 - Tiempos y comparativas
  diasPromedioHastaCerrar: number;    // DuracionMinutos convertido a días
  porcentajeCumplimientoSLA: number;  // % dentro de SLA
  estaSemanaVsAnterior: {
    creadosPct: number;   // cambio % en creados
    cerradosPct: number;  // cambio % en cerrados
  };

  // Distribución por Categoría (barras horizontales)
  distribucionCategoria: Array<{
    categoria: string;
    cantidad: number;
  }>;

  // Tickets por Día de la Semana
  ticketsByDay: Array<{
    day: string; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    count: number;
  }>;

  // Distribución por Prioridad
  ticketsByPriority: {
    Urgente: number;
    Alta: number;
    Media: number;
    Baja: number;
  };

  // SLA Compliance
  slaCompliance: {
    compliant: number;
    exceeded: number;
  };

  // Distribución por Canal (pie chart)
  distribucionCanal: Array<{
    canal: string;
    cantidad: number;
  }>;

  // Distribución por Tipo (pie chart)
  distribucionTipo: Array<{
    tipo: string;
    cantidad: number;
  }>;

  generatedAt: string; // ISO timestamp
}

/**
 * Formatea una fecha a formato español: "03 de junio del 2026"
 */
function formatDateSpanish(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} del ${year}`;
}

/**
 * Convierte minutos a días o horas (< 1 día)
 */
function formatDurationFromMinutes(minutes: number): string {
  const days = minutes / 1440;
  if (days >= 1) {
    return `${days.toFixed(1)} días`;
  }
  const hours = minutes / 60;
  return `${hours.toFixed(1)} hrs`;
}

/**
 * Verifica si un array de objetos con cantidad tiene datos
 */
function hasData(arr: Array<{ cantidad: number }>): boolean {
  return arr.length > 0 && arr.some((item) => item.cantidad > 0);
}

/**
 * Verifica si los días de la semana tienen datos
 */
function hasDayData(dias: Array<{ count: number }>): boolean {
  return dias.length > 0 && dias.some((d) => d.count > 0);
}

/**
 * Verifica si la distribución por prioridad tiene datos
 */
function hasPriorityData(priority: { Urgente: number; Alta: number; Media: number; Baja: number }): boolean {
  return Object.values(priority).some((v) => v > 0);
}

/**
 * Verifica si el cumplimiento de SLA tiene datos
 */
function hasSLAData(sla: { compliant: number; exceeded: number }): boolean {
  return sla.compliant > 0 || sla.exceeded > 0;
}

/**
 * Genera reporte HTML profesional con datos de tickets
 */
export function generateReportHTML(data: ReportData): string {
  const maxDayCount = Math.max(...data.ticketsByDay.map((d) => d.count), 1);
  const maxCategoryCount = Math.max(...data.distribucionCategoria.map((c) => c.cantidad), 1);

  // Función para generar pie chart SVG
  const generatePieChart = (items: Array<{ label: string; value: number }>) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
      return '<svg viewBox="0 0 100 100" style="width:150px;height:150px;"><circle cx="50" cy="50" r="40" fill="none" stroke="#ccc" stroke-width="20"/></svg>';
    }

    const colors = ["#ed712a", "#3498db", "#2ecc71", "#f39c12", "#e74c3c", "#9b59b6"];
    let currentDeg = 0;
    let paths = "";

    items.forEach((item, index) => {
      const value = item.value;
      const percent = (value / total) * 100;
      const deg = (percent / 100) * 360;

      const startRad = (currentDeg - 90) * (Math.PI / 180);
      const endRad = (currentDeg + deg - 90) * (Math.PI / 180);

      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);

      const largeArc = deg > 180 ? 1 : 0;

      paths += `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[index % colors.length]}" stroke="white" stroke-width="2"/>`;

      currentDeg += deg;
    });

    return `<svg viewBox="0 0 100 100" style="width:150px;height:150px;">${paths}</svg>`;
  };

  // Generar pie charts
  const canalChart = generatePieChart(
    data.distribucionCanal.map((c) => ({ label: c.canal, value: c.cantidad }))
  );
  const tipoChart = generatePieChart(
    data.distribucionTipo.map((t) => ({ label: t.tipo, value: t.cantidad }))
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Tickets - AgentTickets3B</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #ffffff;
      color: #333;
      line-height: 1.6;
    }
    .container {
      width: 100%;
      background-color: #ffffff;
    }

    /* HEADER */
    .header {
      background-color: #ed712a;
      color: white;
      padding: 30px 24px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
      font-weight: bold;
    }
    .header-date {
      font-size: 14px;
      opacity: 0.95;
    }

    /* CONTENT WRAPPER */
    .content {
      padding: 0 24px;
    }

    /* KPI ROW */
    .kpi-row {
      display: flex;
      gap: 12px;
      padding: 15px 0;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    .kpi-row.no-wrap {
      flex-wrap: nowrap;
    }
    .kpi-card {
      flex: 1;
      min-width: 0;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      padding: 12px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .kpi-label {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .kpi-value.blue { color: #3498db; }
    .kpi-value.green { color: #27ae60; }
    .kpi-value.red { color: #e74c3c; }
    .kpi-value.orange { color: #ed712a; }

    /* KPI Días + Unidad */
    .kpi-value-with-unit {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .kpi-value-number {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .kpi-value-unit {
      font-size: 12px;
      color: #666;
      font-weight: normal;
    }

    /* KPI Porcentajes con color */
    .kpi-percentage-row {
      margin-bottom: 6px;
      font-size: 11px;
    }
    .kpi-percentage-label {
      color: #333;
      font-weight: 600;
      display: inline;
    }
    .kpi-percentage-value {
      font-weight: bold;
      display: inline;
      margin-left: 4px;
    }
    .kpi-percentage-value.positive { color: #27ae60; }
    .kpi-percentage-value.negative { color: #e74c3c; }

    /* SECTION */
    .section {
      padding: 35px 0;
      border-top: 1px solid #f0f0f0;
      margin-top: 15px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 20px;
    }

    /* BARRAS HORIZONTALES */
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bar-label {
      min-width: 150px;
      font-size: 12px;
      color: #333;
      font-weight: 500;
    }
    .bar-container {
      flex: 1;
      height: 22px;
      background-color: #f0f0f0;
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    .bar {
      height: 100%;
      background: #ed712a;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 6px;
      color: white;
      font-size: 10px;
      font-weight: bold;
    }
    .bar-value {
      min-width: 50px;
      text-align: right;
      font-size: 12px;
      color: #666;
    }

    /* BARRAS VERTICALES */
    .vertical-bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      gap: 8px;
      height: 280px;
      padding: 30px 10px 10px 10px;
      position: relative;
    }
    .vertical-bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      flex: 1;
      max-width: 40px;
    }
    .vertical-bar {
      width: 30px;
      background: #ed712a;
      border-radius: 3px 3px 0 0;
      min-height: 10px;
      position: relative;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .vertical-bar-value {
      position: absolute;
      top: -22px;
      font-weight: bold;
      font-size: 12px;
      color: #1a1a1a;
      white-space: nowrap;
    }
    .vertical-bar-label {
      font-size: 11px;
      color: #666;
      text-align: center;
      width: 100%;
      margin-top: 6px;
    }
    .vertical-bar.highlight {
      background: #e74c3c;
    }

    /* PRIORITY CARDS */
    .priority-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 10px;
    }
    .priority-card {
      padding: 20px 16px;
      border-radius: 4px;
      color: white;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.12);
      transition: transform 0.2s ease;
    }
    .priority-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.16);
    }
    .priority-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 10px;
      opacity: 0.95;
      font-weight: 600;
    }
    .priority-value {
      font-size: 32px;
      font-weight: bold;
      line-height: 1;
    }
    .priority-urgente { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); }
    .priority-alta { background: linear-gradient(135deg, #ed712a 0%, #d35400 100%); }
    .priority-media { background: linear-gradient(135deg, #f39c12 0%, #d68910 100%); }
    .priority-baja { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); }

    /* SLA SECTION */
    .sla-section {
      margin-top: 40px;
    }
    .sla-container {
      display: flex;
      align-items: center;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 30px;
    }
    .sla-chart {
      flex: 1;
      min-width: 200px;
      text-align: center;
    }
    .sla-legend {
      flex: 1;
      min-width: 200px;
    }
    .sla-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0;
      font-size: 13px;
    }
    .sla-color {
      width: 24px;
      height: 24px;
      border-radius: 3px;
    }
    .sla-color-compliant { background-color: #27ae60; }
    .sla-color-exceeded { background-color: #e74c3c; }
    .sla-number {
      font-weight: bold;
      color: #1a1a1a;
      font-size: 16px;
    }

    /* PIE CHARTS */
    .pie-charts-row {
      display: flex;
      gap: 40px;
      justify-content: space-around;
      flex-wrap: wrap;
      padding: 20px 0;
    }
    .pie-chart-container {
      text-align: center;
    }
    .pie-chart-title {
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .pie-chart-legend {
      margin-top: 12px;
    }
    .pie-legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #666;
      margin: 4px 0;
    }
    .pie-legend-color {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }

    /* FOOTER */
    .footer {
      background-color: #ed712a;
      color: white;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      margin-top: 30px;
    }
    .footer-brand {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 14px;
    }
    .footer-location {
      margin-top: 4px;
      opacity: 0.9;
      font-size: 10px;
    }

    /* RESPONSIVE */
    @media (max-width: 768px) {
      .header h1 { font-size: 22px; }
      .kpi-row { flex-direction: column; }
      .kpi-card { min-width: 100%; }
      .priority-cards { flex-direction: column; }
      .priority-card { min-width: 100%; }
      .sla-container { flex-direction: column; }
      .vertical-bar-chart { height: 180px; }
      .pie-charts-row { flex-direction: column; }
      .content { padding: 0 16px; }
      .header { padding: 30px 16px; }
      .footer { padding: 20px 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <h1>Reporte de Tickets - Tiendas 3B</h1>
      <div class="header-date">${formatDateSpanish(data.period.startDate)}</div>
    </div>

    <div class="content">
      <!-- KPI FILA 1 - ESTADO -->
      <div class="kpi-row no-wrap">
        <div class="kpi-card">
          <div class="kpi-label">Total</div>
          <div class="kpi-value">${data.totalTickets}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Abiertos</div>
          <div class="kpi-value blue">${data.abiertos}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Cerrados</div>
          <div class="kpi-value green">${data.cerrados}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Vencidos</div>
          <div class="kpi-value red">${data.vencidos}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Sin Asignar</div>
          <div class="kpi-value">${data.sinAsignar}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">% Cierre</div>
          <div class="kpi-value">${data.porcentajeCierre.toFixed(1)}%</div>
        </div>
      </div>

      <!-- KPI FILA 2 - CREACION -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Tickets Hoy</div>
          <div class="kpi-value">${data.ticketsHoy}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Esta Semana</div>
          <div class="kpi-value">${data.estaSemana}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Este Mes</div>
          <div class="kpi-value">${data.esteMes}</div>
        </div>
      </div>

      <!-- KPI FILA 3 - TIEMPOS Y COMPARATIVAS -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Días Promedio Hasta Cerrar</div>
          <div class="kpi-value">${formatDurationFromMinutes(data.diasPromedioHastaCerrar)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">% Cumplimiento SLA</div>
          <div class="kpi-value orange">${data.porcentajeCumplimientoSLA.toFixed(1)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Esta Semana vs Anterior</div>
          <div class="kpi-percentage-row">
            <span class="kpi-percentage-label">Creados:</span>
            <span class="kpi-percentage-value ${data.estaSemanaVsAnterior.creadosPct >= 0 ? "positive" : "negative"}">
              ${data.estaSemanaVsAnterior.creadosPct > 0 ? "+" : ""}${data.estaSemanaVsAnterior.creadosPct.toFixed(0)}%
            </span>
          </div>
          <div class="kpi-percentage-row">
            <span class="kpi-percentage-label">Cerrados:</span>
            <span class="kpi-percentage-value ${data.estaSemanaVsAnterior.cerradosPct >= 0 ? "positive" : "negative"}">
              ${data.estaSemanaVsAnterior.cerradosPct > 0 ? "+" : ""}${data.estaSemanaVsAnterior.cerradosPct.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>



      <!-- DISTRIBUCION POR CATEGORIA -->
      ${hasData(data.distribucionCategoria)
        ? `<div class="section">
        <div class="section-title">Distribución por Categoría</div>
        <div class="bar-chart">
          ${data.distribucionCategoria
            .map((cat) => {
              const percent = ((cat.cantidad / data.totalTickets) * 100).toFixed(1);
              const barWidth = (cat.cantidad / maxCategoryCount) * 100;
              return `<div class="bar-item">
            <div class="bar-label">${cat.categoria}</div>
            <div class="bar-container">
              <div class="bar" style="width: ${barWidth}%;">${cat.cantidad}</div>
            </div>
            <div class="bar-value">${percent}%</div>
          </div>`;
            })
            .join("")}
        </div>
      </div>`
        : ""}

      <!-- DISTRIBUCION POR CANAL -->
      ${hasData(data.distribucionCanal)
        ? `<div class="section">
        <div class="section-title">Distribución por Canal</div>
        <div class="bar-chart">
          ${(() => {
            const maxCanalCount = Math.max(...data.distribucionCanal.map((c) => c.cantidad), 1);
            return data.distribucionCanal
              .sort((a, b) => b.cantidad - a.cantidad)
              .map((canal) => {
                const percent = ((canal.cantidad / data.totalTickets) * 100).toFixed(1);
                const barWidth = (canal.cantidad / maxCanalCount) * 100;
                return `<div class="bar-item">
              <div class="bar-label">${canal.canal}</div>
              <div class="bar-container">
                <div class="bar" style="width: ${barWidth}%;">${canal.cantidad}</div>
              </div>
              <div class="bar-value">${percent}%</div>
            </div>`;
              })
              .join("");
          })()}
        </div>
      </div>`
        : ""}

      <!-- DISTRIBUCION POR TIPO -->
      ${hasData(data.distribucionTipo)
        ? `<div class="section">
        <div class="section-title">Distribución por Tipo</div>
        <div class="bar-chart">
          ${(() => {
            const maxTipoCount = Math.max(...data.distribucionTipo.map((t) => t.cantidad), 1);
            return data.distribucionTipo
              .sort((a, b) => b.cantidad - a.cantidad)
              .map((tipo) => {
                const percent = ((tipo.cantidad / data.totalTickets) * 100).toFixed(1);
                const barWidth = (tipo.cantidad / maxTipoCount) * 100;
                return `<div class="bar-item">
              <div class="bar-label">${tipo.tipo}</div>
              <div class="bar-container">
                <div class="bar" style="width: ${barWidth}%;">${tipo.cantidad}</div>
              </div>
              <div class="bar-value">${percent}%</div>
            </div>`;
              })
              .join("");
          })()}
        </div>
      </div>`
        : ""}

      <!-- SLA -->
      ${hasSLAData(data.slaCompliance)
        ? `<div class="section sla-section">
        <div class="section-title">Cumplimiento de SLA</div>
        <div class="sla-container">
          <div class="sla-chart">
            ${(() => {
              const total = data.slaCompliance.compliant + data.slaCompliance.exceeded;
              const compliantPercent = (data.slaCompliance.compliant / total) * 100;
              const exceededPercent = (data.slaCompliance.exceeded / total) * 100;
              const circumference = 2 * Math.PI * 45;
              const compliantDash = (compliantPercent / 100) * circumference;
              const exceededDash = (exceededPercent / 100) * circumference;
              return `
                <svg viewBox="0 0 200 200" style="width:160px;height:160px;">
                  <circle cx="100" cy="100" r="45" fill="none" stroke="#e0e0e0" stroke-width="30"/>
                  <circle cx="100" cy="100" r="45" fill="none" stroke="#27ae60" stroke-width="30"
                    stroke-dasharray="${compliantDash} ${circumference}"
                    stroke-dashoffset="0"
                    stroke-linecap="round"
                    transform="rotate(-90 100 100)"/>
                  <circle cx="100" cy="100" r="45" fill="none" stroke="#e74c3c" stroke-width="30"
                    stroke-dasharray="${exceededDash} ${circumference}"
                    stroke-dashoffset="${-compliantDash}"
                    stroke-linecap="round"
                    transform="rotate(-90 100 100)"/>
                </svg>
              `;
            })()}
          </div>
          <div class="sla-legend">
            <div class="sla-item">
              <div class="sla-color sla-color-compliant"></div>
              <div>
                <div style="font-weight: bold; color: #27ae60;">Dentro de SLA</div>
                <div class="sla-number">${data.slaCompliance.compliant}</div>
              </div>
            </div>
            <div class="sla-item">
              <div class="sla-color sla-color-exceeded"></div>
              <div>
                <div style="font-weight: bold; color: #e74c3c;">Fuera de SLA</div>
                <div class="sla-number">${data.slaCompliance.exceeded}</div>
              </div>
            </div>
            <div class="sla-item" style="margin-top: 16px;">
              <div style="font-weight: bold; color: #27ae60; font-size: 14px;">
                ${(((data.slaCompliance.compliant) / (data.slaCompliance.compliant + data.slaCompliance.exceeded)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>`
        : ""}
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-brand">Desarrollado por Tiendas 3B</div>
      <div class="footer-location">Santa Cruz - Bolivia 2026</div>
    </div>
  </div>
</body>
</html>`;
}
