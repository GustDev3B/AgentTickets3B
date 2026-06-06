# AgentTickets3B - Instrucciones del Proyecto

## Descripción

**AgentTickets3B** es un agente de análisis de tickets empresariales para un sistema retail de Tiendas 3B. Utiliza el Claude Agent SDK para realizar análisis automático de datos, generar reportes HTML profesionales y enviarlos por correo vía SendGrid.

## Contexto de Negocio

### Sistema de Tickets

El proyecto analiza un sistema de gestión de tickets de soporte con las siguientes características:

- **Múltiples tiendas**: Cada tienda genera tickets sobre diferentes problemas
- **Categorías de problemas**: Incidentes, solicitudes, mejoras, etc.
- **Estados y prioridades**: Seguimiento del ciclo de vida de cada ticket
- **Audiencia**: Gerentes de tienda y líderes de TI requieren análisis semanal

### Requisitos Clave

1. **Análisis automático**: Detectar anomalías, patrones repetidos, tendencias
2. **Reportes visuales**: HTML profesional, compatible con clientes de email
3. **Entrega por mail**: Envío automático a gerentes y stakeholders
4. **Modo interactivo**: Chat para consultas manuales puntuales

## Arquitectura del Proyecto

### Estructura de Carpetas

```
src/
├── config.ts              # Validación de ENV vars con zod
├── index.ts               # Entry point, detecta modo
├── agent/
│   ├── index.ts          # Configuración central del agente
│   ├── prompts.ts        # System prompts y instrucciones
│   └── subagents.ts      # Definición de 3 subagentes
├── auth/
│   └── azure.ts          # Autenticación Azure AD (2 estrategias)
├── tools/
│   ├── fabric.ts         # Config MCP para Microsoft Fabric
│   └── sendgrid.ts       # Envío de emails vía SendGrid
└── modes/
    ├── chat.ts           # CLI interactiva
    └── scheduled.ts      # Ejecución para Azure RunBook
```

### Componentes Principales

#### 1. **Configuración (config.ts)**
- Validación de todas las ENV vars con zod
- Tipado fuerte de todas las variables
- Falsa segura en startup si faltan datos obligatorios

#### 2. **Autenticación (auth/azure.ts)**
- **Estrategia 1**: User Token (desarrollo)
- **Estrategia 2**: Service Principal (producción)
- Detección automática según ENV vars disponibles
- Cache de tokens para evitar múltiples requests

#### 3. **Integración Fabric (tools/fabric.ts)**
- Configuración MCP Server con Bearer token
- Fallback OpenAI-compatible para robustez
- Funciones para consultar el Data Lake

#### 4. **Envío de Email (tools/sendgrid.ts)**
- Uso de fetch nativo (sin SDK oficial)
- Llamadas a API v3 de SendGrid
- Manejo de errores y confirmación

#### 5. **Agente Principal (agent/)**
- System prompt con contexto del negocio
- Tres subagentes especializados:
  - **data-analyst**: Consulta Fabric, analiza datos
  - **report-generator**: Genera HTML profesional
  - **mail-sender**: Envía reporte por correo

#### 6. **Modos de Ejecución**
- **Chat (chat.ts)**: Interfaz interactiva con readline
  - Comandos: /exit, /new, /report, /help
  - Persistencia de sesión con sessionId
  - Streaming de respuestas en tiempo real
  
- **Scheduled (scheduled.ts)**: Para Azure RunBook
  - Sin interacción del usuario
  - Logs con timestamps
  - Timeout de 10 minutos
  - Código de salida: 0 (éxito) o 1 (error)

## Integración con Microsoft Fabric

### URLs Configuradas

**MCP Server (preferida - Usa JSON-RPC 2.0)**:
```
https://api.fabric.microsoft.com/v1/mcp/workspaces/be2ea36c-3935-42e9-9a26-45e22db69941/dataagents/89444cc8-c862-448b-9541-7390574a151b/agent
```

**OpenAI-compatible (fallback)**:
```
https://api.fabric.microsoft.com/v1/workspaces/be2ea36c-3935-42e9-9a26-45e22db69941/dataagents/89444cc8-c862-448b-9541-7390574a151b/aiassistant/openai
```

### DataAgent_TKTAgent

El MCP Server expone un único tool: **DataAgent_TKTAgent**

**Características:**
- Responde a preguntas en lenguaje natural sobre datos de retail
- Tiene acceso a tablas: gold_fact_ventas, gold_fact_facturas, gold_fact_stock_tienda
- Retorna respuestas en texto (que el agente debe parsear)
- Tiempos de respuesta típicos: ~25-30 segundos

**Ejemplo de uso:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "DataAgent_TKTAgent",
    "arguments": {
      "userQuestion": "¿Cuántos tickets existen en total?"
    }
  }
}
```

### Flujo de Autenticación

1. El agente obtiene token Azure AD (estrategia según ENV vars)
2. Envía Bearer token en header Authorization
3. El MCP Server procesa la solicitud JSON-RPC 2.0
4. DataAgent_TKTAgent responde en lenguaje natural
5. data-analyst parsea y estructura en JSON

### FabricMcpClient (src/tools/fabric.ts)

Clase reutilizable para interactuar con el MCP:

```typescript
import { FabricMcpClient, getFabricClient } from "./tools/fabric.js";

// Usar singleton
const client = await getFabricClient();
const respuesta = await client.query("¿Cuáles son las tiendas con mayor volumen?");

// O crear instancia propia
const customClient = new FabricMcpClient();
await customClient.initialize();
const respuesta = await customClient.query("...");
```

## Variables de Entorno

| Variable | Propósito | Obligatoria | Estrategia |
|----------|-----------|-------------|-----------|
| `ANTHROPIC_API_KEY` | API key de Anthropic | Sí | - |
| `FABRIC_MCP_URL` | Endpoint MCP de Fabric | Sí | - |
| `FABRIC_OPENAI_URL` | Endpoint OpenAI de Fabric | Sí | - |
| `AZURE_ACCESS_TOKEN` | User token (desarrollo) | No* | User Token |
| `AZURE_TENANT_ID` | ID de tenant Azure AD | No* | Service Principal |
| `AZURE_CLIENT_ID` | ID de aplicación Azure | No* | Service Principal |
| `AZURE_CLIENT_SECRET` | Secret de aplicación Azure | No* | Service Principal |
| `SENDGRID_API_KEY` | API key de SendGrid | Sí | - |
| `REPORT_FROM_EMAIL` | Email remitente | Sí | - |
| `REPORT_RECIPIENTS` | Destinatarios (CSV) | Sí | - |
| `MODE` | Modo de ejecución | No | chat (default) |

*Al menos una estrategia de autenticación debe estar configurada.

## Ontología de Base de Datos

### Ontología Real (Gold TKT) - Descubierta 2026-06-02

La estructura real del Data Lake de Fabric para análisis de tickets de soporte retail:

#### Tablas de Hechos (Fact Tables)

**gold_tkt_fact_ticket** — Tabla principal, un registro por ticket
- **TicketId**: Identificador único de cada ticket
- **NombreGrupo**: Nombre del grupo de soporte asignado (ej: "Sistemas - Soporte Tienda")
- **NombreEstado**: Estado actual (Abierto, Pendiente, Cerrado, etc.)
- **NombrePrioridad**: Nivel de prioridad (Baja, Media, Alta, Urgente, Crítica)
- **NombreCategoria**: Categoría del ticket (tipo de problema reportado)
- **NombreTipoTicket**: Tipo de ticket (Incidente, Requerimiento, POS, Soporte, etc.)
- **NombreCanal**: Canal de origen (App Tienda, teléfono, correo, web, etc.)
- **EsCerrado**: Flag 0/1 indicando si está cerrado
- **EsRechazado**: Flag 0/1 indicando si fue rechazado
- **DuracionMinutos**: Tiempo total de resolución en minutos (puede ser nulo)
- **FechaCreacion**: Fecha y hora de creación (formato timestamp)

**gold_tkt_fact_actividad** — KPIs y métricas por ticket
- Almacena métricas agregadas y KPIs relacionados a cada ticket

**gold_tkt_fact_notificacion** — Notificaciones enviadas por ticket
- Registro de todas las notificaciones generadas para cada ticket

**gold_tkt_fact_evento** — Historial y log de acciones
- Almacena eventos de cambios de estado, reasignaciones, comentarios
- Historial completo de todas las acciones sobre cada ticket

#### Tablas de Dimensiones (Dimension Tables)

**gold_tkt_dim_grupo** — Grupos de soporte
- NombreGrupo: Nombre del grupo
- Descripción: Descripción del grupo
- CorreoNotificacion: Email de notificación del grupo
- Otros campos de configuración

**gold_tkt_dim_prioridad** — Niveles de prioridad
- NombrePrioridad: Nombre del nivel (Baja, Media, Alta, Urgente, Crítica)
- OrdenPrioridad: Orden de importancia numérico
- Otros atributos de configuración

**gold_tkt_dim_estado** — Estados posibles de tickets
- NombreEstado: Nombre del estado
- EsFinal: Flag indicando si es estado final
- EsInicial: Flag indicando si es estado inicial
- Otros atributos

**gold_tkt_dim_canal** — Canales de origen de tickets
- NombreCanal: Nombre del canal (App Tienda, teléfono, etc.)
- Código: Código del canal
- Otros atributos de configuración

#### Datos Reales Actuales

**Ejemplos de Tickets Recientes (2026-05-30)**:
- TicketId: 21410 — Grupo: "Sistemas - Soporte Tienda" | Prioridad: Urgente | Estado: Pendiente
- TicketId: 21409 — Grupo: "Mantenimiento - Soporte Tienda" | Prioridad: Alta | Estado: Pendiente
- TicketId: 21408 — Grupo: "Sistemas - Soporte Tienda" | Prioridad: Urgente | Estado: Pendiente

**Catálogos Activos**:
- Prioridades: Baja, Media, Alta, Urgente, Crítica
- Tipos: Incidente, Requerimiento, POS, Soporte
- Canales: App Tienda (principal)
- Grupos: "Sistemas - Soporte Tienda", "Mantenimiento - Soporte Tienda" (y otros)
- Estados: Abierto, Pendiente, Cerrado (y otros)

## Modos de Ejecución

### Chat Interactivo

```bash
npm run chat
# o
tsx src/index.ts chat
```

Características:
- Prompt esperando input del usuario
- Mantiene conversación con contexto
- Comandos especiales disponibles
- Salida con Ctrl+C

### Ejecución Programada

```bash
npm run scheduled
# o
tsx src/index.ts scheduled
```

Características:
- Sin interacción del usuario
- Genera reporte automático de la semana
- Logs con timestamps
- Manejo graceful de timeouts
- Código de salida apropiado para RunBook

## Desarrollo y Configuración

### Requisitos Previos

- Node.js >= 18.0.0
- npm o yarn
- Archivo `.env` configurado

### Instalación

```bash
# Clonar/navegar al proyecto
cd AgentTickets3B

# Instalar dependencias
npm install

# Copiar y completar variables de entorno
cp .env.example .env
# Editar .env con tus valores
```

### Desarrollo

```bash
# Modo watch con tsx
npm run dev

# O manualmente
npm run chat
npm run scheduled
```

### Build

```bash
npm run build
# Genera dist/ listo para producción
```

## Despliegue en Azure RunBook

### Pasos de Configuración

1. **Crear Service Principal en Azure**
   ```powershell
   az ad sp create-for-rbac --name AgentTickets3B --role Contributor
   ```

2. **Configurar RunBook**
   - Crear nuevo RunBook en Azure Automation
   - Tipo: PowerShell
   - Agregar módulos: @anthropic-ai/claude-agent-sdk, zod

3. **Script de RunBook**
   ```powershell
   $env:ANTHROPIC_API_KEY = "..."
   $env:AZURE_TENANT_ID = "..."
   $env:AZURE_CLIENT_ID = "..."
   $env:AZURE_CLIENT_SECRET = "..."
   # ... resto de ENV vars
   
   npm install
   npm run scheduled
   ```

4. **Schedule**
   - Configurar para ejecutarse cada lunes a las 8:00 AM
   - O cuando sea necesario

## Pendientes y TODOs

### 1. Ontología de BD Completa
**Status**: ✅ COMPLETADO - Descubierta 2026-06-02
- [x] Estructura real de Gold TKT documentada en CLAUDE.md
- [x] Tablas fact y dimensiones identificadas
- [x] Campos principales mapeados
- [x] Datos reales actuales incluidos

**Actualizado**: `CLAUDE.md` sección "Ontología de Base de Datos"

### 2. Configuración de Destinatarios
**Status**: En progreso
- [ ] Base de datos de destinatarios dinámicos
- [ ] Reglas de envío por tienda
- [ ] Suscripciones personalizadas

**Acción**: Expandir `sendgrid.ts` con lógica de destinatarios

### 3. Migración a Service Principal
**Status**: Preparado pero no probado
- [ ] Crear Service Principal en Azure
- [ ] Probar flujo OAuth2 client_credentials
- [ ] Documentar pasos de configuración

**Acción**: Ejecutar en ambiente de staging

### 4. Testing Completo
**Status**: No iniciado
- [ ] Unit tests para config, auth, tools
- [ ] Integration tests con Fabric (mock)
- [ ] E2E tests para chat y scheduled

**Acción**: Agregar jest y escribir test suite

### 5. Integración Real con Claude Agent SDK
**Status**: En demostración
- [ ] Implementar `query()` real del SDK
- [ ] Streaming de respuestas en chat
- [ ] Manejo de tool calls de los subagentes

**Acción**: Reemplazar simulaciones con llamadas reales al SDK

## Notas para Desarrollo

### Convenciones de Código

- **TypeScript estricto**: `strict: true` en tsconfig.json
- **Sin any implícitos**: Tipado fuerte en todos lados
- **Español en logs y comentarios**: Para consistencia con usuarios
- **Inglés en nombres de variables y funciones**: Para estándar técnico
- **Manejo de errores**: Try-catch en puntos de integración externa

### Logging

- Timestamps ISO en modo scheduled
- Emojis para claridad visual en modo chat
- Mensajes de error descriptivos
- Flujo de proceso claro y auditable

### Dependencias Mínimas

Se evita deliberadamente:
- Azure SDK oficial (usamos fetch nativo)
- SendGrid SDK oficial (usamos fetch nativo)
- Frameworks web (NestJS, Express)
- ORMs (Prisma, TypeORM)

Esto mantiene el bundle pequeño y las dependencias manejables.

## Contacto y Soporte

- **Email de proyecto**: noreply@tiendas3b.com.bo
- **Responsable**: Equipo de TI - Tiendas 3B
- **Última actualización**: 2026-05-30
