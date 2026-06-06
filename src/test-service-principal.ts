import "dotenv/config";
import { getCachedAccessToken } from "./auth/azure.js";
import { config } from "./config.js";

async function testServicePrincipal(): Promise<void> {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  Prueba Service Principal Token            ║");
  console.log("╚════════════════════════════════════════════╝\n");

  // Verificar que User Token NO esté configurado
  if (config.AZURE_ACCESS_TOKEN) {
    console.log("⚠️  AZURE_ACCESS_TOKEN está configurado - removelo para probar Service Principal");
    console.log("   Método: Comentá o eliminá la línea en .env\n");
    process.exit(1);
  }

  // Verificar que Service Principal esté configurado
  if (!config.AZURE_TENANT_ID || !config.AZURE_CLIENT_ID || !config.AZURE_CLIENT_SECRET) {
    console.log("❌ Faltan variables de Service Principal:");
    console.log(`   AZURE_TENANT_ID: ${config.AZURE_TENANT_ID ? "✓" : "❌"}`);
    console.log(`   AZURE_CLIENT_ID: ${config.AZURE_CLIENT_ID ? "✓" : "❌"}`);
    console.log(`   AZURE_CLIENT_SECRET: ${config.AZURE_CLIENT_SECRET ? "✓" : "❌"}`);
    process.exit(1);
  }

  console.log("📋 Configuración detectada:");
  console.log(`   Tenant ID: ${config.AZURE_TENANT_ID.substring(0, 8)}...`);
  console.log(`   Client ID: ${config.AZURE_CLIENT_ID.substring(0, 8)}...`);
  console.log(`   Client Secret: ${config.AZURE_CLIENT_SECRET ? "✓ Configurado" : "❌ No configurado"}`);

  try {
    console.log("\n⏳ Obteniendo token de Service Principal...");
    const token = await getCachedAccessToken();

    if (!token) {
      console.log("❌ Token vacío");
      process.exit(1);
    }

    const tokenPreview = token.substring(0, 20) + "..." + token.substring(token.length - 10);
    console.log(`\n✅ Token obtenido exitosamente`);
    console.log(`   Token preview: ${tokenPreview}`);
    console.log(`   Length: ${token.length} caracteres`);

    console.log("\n✅ Service Principal funcionando correctamente");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error al obtener token:`);
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);

    console.log("\n💡 Posibles soluciones:");
    console.log("   1. Verificá que el Tenant ID sea correcto");
    console.log("   2. Verificá que el Client ID sea correcto");
    console.log("   3. Verificá que el Client Secret sea correcto");
    console.log("   4. Verificá que el Service Principal tenga permisos en Microsoft Fabric");
    console.log("   5. Verificá que el Service Principal está activo (no expirado)");

    process.exit(1);
  }
}

testServicePrincipal();
