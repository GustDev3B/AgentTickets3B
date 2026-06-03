# AgentTickets3B

Agente inteligente de análisis de tickets empresariales para Tiendas 3B, potenciado por Claude Agent SDK.

## 🎯 Características

- **Análisis automático de tickets**: Detecta anomalías, patrones y tendencias
- **Reportes HTML profesionales**: Visualización clara y compatible con email
- **Entrega automática**: Envío semanal via SendGrid a stakeholders
- **Chat interactivo**: Consultas manuales ad-hoc desde terminal
- **Multi-tienda**: Análisis de datos de múltiples ubicaciones
- **Escalable**: Arquitectura con subagentes especializados

## 📋 Requisitos

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- Cuentas en:
  - [Anthropic](https://anthropic.com) - API key de Claude
  - [SendGrid](https://sendgrid.com) - API key para email
  - Microsoft Azure - Token de acceso a Fabric

## 🚀 Instalación Rápida

```bash
# 1. Clonar el repositorio
git clone https://github.com/tiendas3b/AgentTickets3B.git
cd AgentTickets3B

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección de Configuración)

# 4. Verificar configuración
npm run build
```

## ⚙️ Configuración

### Variables de Entorno Requeridas

Copia `.env.example` a `.env` y completa los valores:

```bash
# Anthropic (requierido)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Microsoft Fabric (requierido)
FABRIC_MCP_URL=https://api.fabric.microsoft.com/v1/mcp/workspaces/...
FABRIC_OPENAI_URL=https://api.fabric.microsoft.com/v1/workspaces/...

# Azure AD (elige una estrategia)
# Estrategia 1: User Token (desarrollo)
AZURE_ACCESS_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGc...

# Estrategia 2: Service Principal (producción)
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# SendGrid (requierido)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Reportes (requierido)
REPORT_FROM_EMAIL=noreply@tiendas3b.com.bo
REPORT_RECIPIENTS=gerente@tiendas3b.com.bo,analista@tiendas3b.com.bo

# Opcional
MODE=chat  # "chat" o "scheduled"
```

## 📖 Uso

### Modo Chat (Interactivo)

Acceso interactivo para consultas ad-hoc:

```bash
npm run chat
# o
npm start
```

**Comandos disponibles:**
- `/exit` - Salir de la aplicación
- `/new` - Iniciar nueva sesión
- `/report` - Generar reporte semanal completo
- `/help` - Mostrar ayuda

**Ejemplo:**
```
🚀 AgentTickets3B - Modo: chat

Comandos disponibles:
  /exit    - Salir de la aplicación
  /new     - Iniciar una nueva sesión
  /report  - Generar reporte semanal completo
  /help    - Mostrar esta ayuda

Sesión iniciada: d3d8a5f2-b4c1-4eaf-8c6f-9e7d8a2b5c3f

Tú: ¿Cuál es el volumen de tickets en la tienda 5?
Asistente: Consultando el Data Lake de Fabric...

Tú: /report
📊 Generando reporte semanal...
✓ Reporte encolado para procesamiento

Tú: /exit
👋 ¡Hasta luego!
```

### Modo Scheduled (Automático)

Ejecución programada (típicamente desde Azure RunBook):

```bash
npm run scheduled
```

**Salida típica:**
```
[2026-05-30T08:00:00.000Z] ╔════════════════════════════════════════════╗
[2026-05-30T08:00:00.000Z] ║  AgentTickets3B - Modo Scheduled           ║
[2026-05-30T08:00:00.000Z] ║  (Ejecutado por Azure RunBook)             ║
[2026-05-30T08:00:00.000Z] ╚════════════════════════════════════════════╝
[2026-05-30T08:00:00.000Z] 📅 Analizando tickets de la semana: 26/05 al 01/06
[2026-05-30T08:00:00.000Z] 📧 Destinatarios: gerente@tiendas3b.com.bo, analista@tiendas3b.com.bo
[2026-05-30T08:00:00.000Z] ⚙️  Cargando configuración del agente...
[2026-05-30T08:00:01.000Z] ✓ Configuración cargada exitosamente
[2026-05-30T08:00:02.000Z] ✓ Reporte enviado exitosamente a 2 destinatario(s)
```

## 🏗️ Estructura del Proyecto

```
AgentTickets3B/
├── src/
│   ├── config.ts              # Validación de ENV vars (zod)
│   ├── index.ts               # Entry point principal
│   ├── agent/
│   │   ├── index.ts          # Configuración del agente
│   │   ├── prompts.ts        # System prompts
│   │   └── subagents.ts      # Definición de subagentes
│   ├── auth/
│   │   └── azure.ts          # Autenticación Azure AD
│   ├── tools/
│   │   ├── fabric.ts         # Integración Microsoft Fabric
│   │   └── sendgrid.ts       # Integración SendGrid
│   └── modes/
│       ├── chat.ts           # Modo interactivo
│       └── scheduled.ts      # Modo automático
├── docs/
│   └── PROJECT_CONTEXT.md    # Documentación completa
├── CLAUDE.md                 # Instrucciones para IA
├── .env.example              # Template de variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 📊 Flujo de Datos

### Modo Chat

```
Usuario
  ↓
readline (CLI)
  ↓
createAgentConfig()
  ↓
Claude Agent (con subagentes)
  ↓
Respuesta con contexto
  ↓
Console output
```

### Modo Scheduled

```
Azure RunBook (lunes 8:00 AM)
  ↓
scheduled.ts
  ↓
Análisis automático
  ├─ data-analyst: Consulta Fabric
  ├─ report-generator: Genera HTML
  └─ mail-sender: Envía por email
  ↓
Destinatarios reciben reporte
  ↓
Exit code 0 (éxito) o 1 (error)
```

## 🔐 Seguridad

### Autenticación Azure AD

**Desarrollo (User Token)**:
```
AZURE_ACCESS_TOKEN → Requests a Fabric → Bearer Authorization
```

**Producción (Service Principal)**:
```
AZURE_CLIENT_ID + AZURE_CLIENT_SECRET → OAuth2 → Token → Bearer
```

### Credenciales

- **Nunca** commitear `.env` (está en `.gitignore`)
- **Nunca** loguear API keys completos
- **Siempre** usar variables de entorno
- **Rotar** credenciales regularmente

## 📈 Características del Análisis

El agente detecta:

- ✓ **Anomalías de volumen**: Tiendas con picos inusuales
- ✓ **Tickets repetidos**: Problemas reiterados
- ✓ **Tickets mal formados**: Registros incompletos
- ✓ **Tendencias temporales**: Patrones por día/hora
- ✓ **Categorías frecuentes**: Qué problemas son más comunes

## 🔧 Desarrollo

### Scripts Disponibles

```bash
npm run start      # Inicia en modo chat (default)
npm run chat       # Modo chat explícitamente
npm run scheduled  # Modo scheduled
npm run build      # Compila TypeScript a dist/
npm run dev        # Watch mode con tsx
```

### TypeScript Estricto

El proyecto usa `strict: true` en `tsconfig.json`:

```bash
# Verifica tipos
npm run build

# Ejecuta con type-checking
npm run dev
```

### Logging

Todos los módulos loguean con timestamps:

```typescript
console.log(`[${timestamp}] 🔧 Tool call: ${toolName}`);
```

## 📧 Estructura del Reporte HTML

El reporte generado incluye:

- **Encabezado**: Logo, título, período
- **Resumen ejecutivo**: KPIs principales
- **Anomalías**: Alertas en rojo/amarillo
- **Tendencias**: Gráficos de tickets por día
- **Categorías**: Top issues detectados
- **Recomendaciones**: Acciones sugeridas
- **Footer**: Timestamp, generado por AgentTickets3B

**Compatibilidad**: Outlook, Gmail, Apple Mail, etc. (CSS inline, sin JavaScript)

## 🚀 Despliegue en Producción

### Azure RunBook

1. **Crear Service Principal**:
   ```bash
   az ad sp create-for-rbac --name "AgentTickets3B"
   ```

2. **Crear Runbook**:
   - Type: PowerShell
   - Trigger: Weekly (Monday, 8:00 AM)

3. **Script**:
   ```powershell
   cd C:\code\AgentTickets3B
   npm install --production
   $env:ANTHROPIC_API_KEY = "..."
   npm run scheduled
   ```

4. **Monitoreo**:
   - Ver logs en Azure Automation Jobs
   - Recibir emails en hora programada
   - Alertas si exit code != 0

## 📝 Documentación

- **[CLAUDE.md](./CLAUDE.md)** - Instrucciones para IA y contexto del proyecto
- **[docs/PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md)** - Documentación completa y detallada
- **[.env.example](./.env.example)** - Variables de entorno con comentarios

## 🐛 Troubleshooting

### Error: "ANTHROPIC_API_KEY es requerido"

```bash
# Verificar .env
cat .env | grep ANTHROPIC_API_KEY

# Debe tener un valor válido
ANTHROPIC_API_KEY=sk-ant-xxxxxx...
```

### Error: "Failed to obtain token"

```bash
# Verificar Azure AD config
# Opción 1: User token debe ser válido
AZURE_ACCESS_TOKEN=eyJ...

# Opción 2: Service Principal requiere los 3 campos
AZURE_TENANT_ID=xxxxxxxx...
AZURE_CLIENT_ID=xxxxxxxx...
AZURE_CLIENT_SECRET=xxxxxxxx...
```

### Error: "Fabric API request failed"

```bash
# Verificar URLs en .env
echo $FABRIC_MCP_URL
echo $FABRIC_OPENAI_URL

# Ambas deben ser URLs válidas de Fabric
```

### No llegan emails

```bash
# Verificar SendGrid API key
SENDGRID_API_KEY=SG.xxxxxxxx...

# Verificar destinatarios
REPORT_RECIPIENTS=email1@domain,email2@domain

# Ver logs en modo scheduled
npm run scheduled 2>&1 | grep -i "sendgrid\|mail"
```

## 📞 Soporte

- **Documentación técnica**: Ver `docs/PROJECT_CONTEXT.md`
- **Instrucciones de IA**: Ver `CLAUDE.md`
- **Issues**: [GitHub Issues](https://github.com/tiendas3b/AgentTickets3B/issues)
- **Email**: Equipo de TI - Tiendas 3B

## 📄 Licencia

Interno - Tiendas 3B

## ✅ Checklist de Setup

- [ ] Node.js >= 18.0.0 instalado
- [ ] `npm install` ejecutado
- [ ] `.env` creado desde `.env.example`
- [ ] `ANTHROPIC_API_KEY` configurado
- [ ] Azure AD token/SP configurado
- [ ] `SENDGRID_API_KEY` configurado
- [ ] `REPORT_FROM_EMAIL` configurado
- [ ] `REPORT_RECIPIENTS` configurado
- [ ] `npm run build` ejecuta sin errores
- [ ] `npm run chat` inicia sin errores
- [ ] Leído `CLAUDE.md` y `docs/PROJECT_CONTEXT.md`

---

**Última actualización**: 2026-05-30  
**Versión**: 1.0.0  
**Estado**: En desarrollo
#   A g e n t T i c k e t s 3 B  
 #   A g e n t T i c k e t s 3 B  
 