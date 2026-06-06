import "dotenv/config";
import { getCachedAccessToken } from "./auth/azure.js";
import { config } from "./config.js";

interface FabricResponse {
  success: boolean;
  endpoint: string;
  status?: number;
  data?: unknown;
  error?: string;
}

async function callMcpMethod(
  method: string,
  params: Record<string, unknown>
): Promise<{ status: number; data: unknown; error?: string }> {
  try {
    const token = await getCachedAccessToken();

    const jsonRpcPayload = {
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    };

    const response = await fetch(config.FABRIC_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonRpcPayload),
    });

    const data = await response.json();

    return {
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testMcpInitialize(): Promise<FabricResponse> {
  console.log("\n🔌 Probando MCP initialize...");
  try {
    const result = await callMcpMethod("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "AgentTickets3B",
        version: "1.0.0",
      },
    });

    if (result.status === 200) {
      console.log(`✓ MCP initialize exitoso (HTTP ${result.status})`);
      console.log("\n📝 Respuesta del servidor:");
      console.log(JSON.stringify(result.data, null, 2));
      return {
        success: true,
        endpoint: "MCP Initialize",
        status: result.status,
        data: result.data,
      };
    } else {
      console.log(
        `⚠ MCP initialize retornó: HTTP ${result.status}`
      );
      console.log("\n📝 Respuesta del servidor:");
      console.log(JSON.stringify(result.data, null, 2));
      return {
        success: false,
        endpoint: "MCP Initialize",
        status: result.status,
        error: JSON.stringify(result.data),
      };
    }
  } catch (error) {
    console.log(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      endpoint: "MCP Initialize",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testMcpListTools(): Promise<FabricResponse> {
  console.log("\n🔧 Probando MCP tools/list...");
  try {
    const result = await callMcpMethod("tools/list", {});

    if (result.status === 200) {
      console.log(`✓ MCP tools/list exitoso (HTTP ${result.status})`);
      console.log("\n📝 Respuesta del servidor:");
      console.log(JSON.stringify(result.data, null, 2));

      // Intentar extraer la lista de tools
      if (result.data && typeof result.data === "object") {
        const dataObj = result.data as Record<string, unknown>;
        if (dataObj.result && typeof dataObj.result === "object") {
          const resultObj = dataObj.result as Record<string, unknown>;
          if (Array.isArray(resultObj.tools)) {
            console.log(
              `\n📋 Tools disponibles: ${resultObj.tools.length}`
            );
            resultObj.tools.forEach((tool: unknown, index: number) => {
              if (typeof tool === "object" && tool !== null) {
                const toolObj = tool as Record<string, unknown>;
                console.log(`  ${index + 1}. ${toolObj.name}`);
              }
            });
          }
        }
      }

      return {
        success: true,
        endpoint: "MCP Tools/List",
        status: result.status,
        data: result.data,
      };
    } else {
      console.log(
        `⚠ MCP tools/list retornó: HTTP ${result.status}`
      );
      console.log("\n📝 Respuesta del servidor:");
      console.log(JSON.stringify(result.data, null, 2));
      return {
        success: false,
        endpoint: "MCP Tools/List",
        status: result.status,
        error: JSON.stringify(result.data),
      };
    }
  } catch (error) {
    console.log(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      endpoint: "MCP Tools/List",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testAzureAuthentication(): Promise<FabricResponse> {
  console.log("\n🔐 Probando autenticación Azure AD...");
  try {
    const token = await getCachedAccessToken();

    if (token && token.length > 20) {
      console.log(`✓ Token obtenido exitosamente`);
      console.log(`  Tipo de token: ${token.substring(0, 20)}...`);

      // Intentar decodificar el JWT si es posible
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64").toString()
          );
          console.log(`  Información del token:`);
          console.log(`    - Usuario: ${payload.unique_name || payload.upn || "N/A"}`);
          console.log(`    - Tenant: ${payload.tid || "N/A"}`);
          console.log(`    - Expira en: ${new Date(payload.exp * 1000).toLocaleString()}`);
        } catch {
          console.log(`  (Token JWT pero no se pudo decodificar)`);
        }
      }

      return {
        success: true,
        endpoint: "Azure AD",
        data: { tokenLength: token.length, preview: token.substring(0, 30) },
      };
    } else {
      return {
        success: false,
        endpoint: "Azure AD",
        error: "Token vacío o muy corto",
      };
    }
  } catch (error) {
    console.log(
      `❌ Error auth: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      success: false,
      endpoint: "Azure AD",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  AgentTickets3B - Test Connection Script   ║");
  console.log("║  Probando MCP JSON-RPC 2.0                 ║");
  console.log("╚════════════════════════════════════════════╝");

  console.log("\n📋 Validando variables de entorno...");
  console.log(`  ✓ FABRIC_MCP_URL: ${config.FABRIC_MCP_URL.substring(0, 50)}...`);

  const results: FabricResponse[] = [];

  // Probar autenticación
  const authResult = await testAzureAuthentication();
  results.push(authResult);

  if (!authResult.success) {
    console.log(
      "\n❌ No se pudo obtener token Azure AD. Deteniendo pruebas."
    );
    process.exit(1);
  }

  // Probar MCP initialize
  const initResult = await testMcpInitialize();
  results.push(initResult);

  // Probar MCP tools/list
  const toolsResult = await testMcpListTools();
  results.push(toolsResult);

  // Resumen final
  console.log("\n" + "═".repeat(50));
  console.log("📊 RESUMEN DE PRUEBAS:");
  console.log("═".repeat(50));

  const successful = results.filter((r) => r.success).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.success ? "✓" : "❌";
    console.log(`${icon} ${result.endpoint}`);
    if (!result.success && result.error) {
      const errorPreview = result.error.substring(0, 100);
      console.log(`  └─ Error: ${errorPreview}${result.error.length > 100 ? "..." : ""}`);
    }
  });

  console.log("\n" + "═".repeat(50));
  console.log(`✅ ${successful}/${total} pruebas exitosas`);
  console.log("═".repeat(50) + "\n");

  if (successful === total) {
    console.log("🎉 Todas las pruebas funcionan correctamente!");
    process.exit(0);
  } else {
    console.log("⚠️  Algunas pruebas fallaron. Revisa la configuración.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "❌ Error fatal:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
