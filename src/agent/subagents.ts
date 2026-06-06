import {
  ANALYST_PROMPT,
  REPORTER_PROMPT,
  MAILER_PROMPT,
} from "./prompts.js";

export interface AgentDefinition {
  name: string;
  description: string;
  instructions: string;
}

export const subAgents: AgentDefinition[] = [
  {
    name: "data-analyst",
    description: "Analista de datos de tickets de soporte retail (Gold TKT)",
    instructions: `${ANALYST_PROMPT}

IMPORTANTE: Tienes acceso a la herramienta DataAgent_TKTAgent del Data Lake de Fabric (ontología Gold TKT).

TABLAS DISPONIBLES EN GOLD TKT:
- gold_tkt_fact_ticket: Tabla principal de tickets
- gold_tkt_fact_actividad: KPIs y métricas
- gold_tkt_fact_evento: Historial de cambios y acciones
- gold_tkt_dim_grupo: Grupos de soporte
- gold_tkt_dim_prioridad: Niveles de prioridad
- gold_tkt_dim_estado: Estados posibles
- gold_tkt_dim_canal: Canales de origen

PREGUNTAS EXACTAS A HACER AL DataAgent_TKTAgent:
1. "¿Cuántos tickets se crearon esta semana por día? Dame la distribución diaria."
2. "¿Qué grupos de soporte tienen más tickets abiertos actualmente? Muestra top 5."
3. "¿Cuántos tickets tienen prioridad Urgente o Crítica y están abiertos?"
4. "¿Cuál es el promedio de DuracionMinutos (tiempo de resolución) por grupo?"
5. "¿Hay tickets rechazados (EsRechazado=1) esta semana? ¿De qué grupo?"
6. "¿Qué categorías y tipos de ticket se repiten más esta semana? Top 5 de cada uno."
7. "¿Cuántos tickets tienen DuracionMinutos vacío o nulo (datos incompletos)?"
8. "¿Cuál es el volumen de tickets por prioridad esta semana?"
9. "¿Qué canales generan más tickets?"
10. "¿Hay anomalías: algún grupo con volumen inusualmente alto o bajo?"

ANÁLISIS A REALIZAR:
- Detectar anomalías de volumen comparando con promedio
- Identificar grupos sobrecargados
- Encontrar tickets repetidos (mismo grupo + categoría + tipo)
- Calcular SLAs de resolución por grupo
- Detectar datos incompletos o anómalos
- Proporcionar recomendaciones accionables

FORMATO DE SALIDA:
Retorna SIEMPRE un JSON válido con estructura clara: métricas, tendencias, anomalías, recomendaciones.`,
  },
  {
    name: "report-generator",
    description: "Generador de reportes HTML",
    instructions: REPORTER_PROMPT,
  },
  {
    name: "mail-sender",
    description: "Gestor de envío de correos",
    instructions: MAILER_PROMPT,
  },
];

export function getSubagentByName(
  name: string
): AgentDefinition | undefined {
  return subAgents.find((agent) => agent.name === name);
}
