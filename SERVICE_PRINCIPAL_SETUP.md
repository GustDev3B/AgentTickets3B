# Configuración de Service Principal para AgentTickets3B

## ¿Por qué Service Principal?

El **Service Principal** es necesario para **producción** (Azure RunBooks). El **User Token** es solo para desarrollo.

## Pasos para Crear Service Principal en Azure AD

### 1. Crear el Service Principal

```powershell
# En Azure PowerShell
az ad sp create-for-rbac --name AgentTickets3B --role Contributor --scopes /subscriptions/{subscription-id}
```

Esto retorna:
```json
{
  "appId": "xxxxx-xxxx-xxxx-xxxx-xxxxx",
  "password": "xxxxx~xxxxx-xxxxx.xxxxx",
  "tenant": "xxxxx-xxxx-xxxx-xxxx-xxxxx",
  "displayName": "AgentTickets3B"
}
```

### 2. Asignar Permisos en Microsoft Fabric

El Service Principal necesita acceso a Microsoft Fabric Data Agent. Pasos:

1. Ir a **Azure Portal** → **App registrations**
2. Buscar **AgentTickets3B**
3. Ir a **API permissions**
4. Click **Add a permission**
5. Seleccionar **APIs my organization uses**
6. Buscar **Fabric** o **Power BI**
7. Seleccionar **Delegated permissions** o **Application permissions**
8. Grant admin consent

### 3. Configurar Variables de Entorno

En el archivo `.env`, **comentá o eliminá** `AZURE_ACCESS_TOKEN` y configura:

```bash
# COMENTÁ ESTO (solo para desarrollo):
# AZURE_ACCESS_TOKEN=eyJ0eXAi...

# CONFIGURA ESTO (para producción):
AZURE_TENANT_ID=xxxxx-xxxx-xxxx-xxxx-xxxxx
AZURE_CLIENT_ID=xxxxx-xxxx-xxxx-xxxx-xxxxx
AZURE_CLIENT_SECRET=xxxxx~xxxxx-xxxxx.xxxxx
```

**Valores:**
- `AZURE_TENANT_ID`: El valor "tenant" del comando az ad sp
- `AZURE_CLIENT_ID`: El valor "appId" del comando az ad sp
- `AZURE_CLIENT_SECRET`: El valor "password" del comando az ad sp

## Probar la Configuración

### Opción 1: Script de Prueba Local

```bash
npm run test:sp
```

Esto verificará:
- ✓ Service Principal está configurado
- ✓ User Token está deshabilitado
- ✓ Token se obtiene exitosamente
- ✓ Permisos de Fabric funcionan

### Opción 2: Probar Flujo Completo

```bash
npm run test:flow
```

Si funciona:
```
✓ Datos obtenidos de Fabric (DataAgent_TKTAgent)
✓ HTML generado desde template
✓ Mail enviado por SendGrid
```

## Errores Comunes

### ❌ Error 400: invalid_client

```
Azure AD token request failed: 400 Bad Request
```

**Causas:**
1. `AZURE_CLIENT_ID` inválido o incorrecto
2. `AZURE_CLIENT_SECRET` expirado (regenerar)
3. Service Principal está deshabilitado

**Solución:**
```bash
# Verificá los valores
echo $env:AZURE_CLIENT_ID
echo $env:AZURE_TENANT_ID

# Regenerá el secret si expiró
az ad sp credential reset --id {appId}
```

### ❌ Error 401: Unauthorized

```
Azure AD token request failed: 401 Unauthorized
```

**Causa:** Credentials son incorrectos

**Solución:**
- Copiá exactamente los valores del comando `az ad sp create-for-rbac`
- No agregués espacios extras
- Escapá caracteres especiales en PowerShell con backticks (`)

### ❌ Error "Scope not found"

```
The scope ... does not exist
```

**Causa:** El tenant no tiene acceso a Fabric

**Solución:**
- Verificá que el subscription tiene Fabric habilitado
- Verificá que el Service Principal tiene permisos en Fabric
- Contactá a Azure Support

## Diferencia: User Token vs Service Principal

| Aspecto | User Token | Service Principal |
|---------|-----------|-------------------|
| **Uso** | Desarrollo local | Producción (RunBooks) |
| **Duración** | ~1 hora | ~1 hora (renovable) |
| **Variables** | `AZURE_ACCESS_TOKEN` | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` |
| **Cómo obtener** | Azure Portal → Token | `az ad sp create-for-rbac` |
| **Renovación** | Manual | Automática |
| **Seguridad** | Usuario individual | Service account |

## Flujo de Autenticación en AgentTickets3B

```
src/auth/azure.ts:

1. ¿Hay AZURE_ACCESS_TOKEN configurado?
   ✓ Sí → Usar User Token (desarrollo)
   ✗ No → Ir al paso 2

2. ¿Hay AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET?
   ✓ Sí → Obtener token de Service Principal
   ✗ No → Error: Faltan variables
```

## Despliegue en Azure RunBook

Una vez que Service Principal funciona localmente:

```powershell
# En Azure RunBook (PowerShell)

# Asignar variables de entorno
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:AZURE_TENANT_ID = "xxxxx..."
$env:AZURE_CLIENT_ID = "xxxxx..."
$env:AZURE_CLIENT_SECRET = "xxxxx..."
$env:FABRIC_MCP_URL = "https://api.fabric.microsoft.com/..."
# ... resto de variables

# Instalar dependencias
npm install

# Ejecutar flujo
npm run scheduled

# Exit code: 0 (exitoso) | 1 (error)
```

## Soporte

Si sigue habiendo problemas:

1. Verificá que el Service Principal está activo
2. Verificá que el secret no expiró (regenerá si es necesario)
3. Contactá a Azure Support para verificar permisos de Fabric
4. Revisá los logs: `npm run test:sp` mostrará más detalles
