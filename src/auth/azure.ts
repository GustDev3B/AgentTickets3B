import { config } from "../config.js";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

async function getServicePrincipalToken(): Promise<string> {
  if (
    !config.AZURE_TENANT_ID ||
    !config.AZURE_CLIENT_ID ||
    !config.AZURE_CLIENT_SECRET
  ) {
    throw new Error(
      "Service Principal requiere AZURE_TENANT_ID, AZURE_CLIENT_ID y AZURE_CLIENT_SECRET"
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: config.AZURE_CLIENT_ID,
    client_secret: config.AZURE_CLIENT_SECRET,
    scope: "https://api.fabric.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  try {
    console.log(`⏳ Solicitando token a: ${tokenUrl}`);
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Error ${response.status}: ${errorBody}`);
      throw new Error(
        `Azure AD token request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as TokenResponse;
    console.log("✓ Token obtenido exitosamente");
    return data.access_token;
  } catch (error) {
    throw new Error(
      `Failed to obtain Service Principal token: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getAccessToken(): Promise<string> {
  // Estrategia 1: User token (desarrollo)
  if (config.AZURE_ACCESS_TOKEN) {
    console.log("✓ Usando autenticación de usuario (Azure AD)");
    return config.AZURE_ACCESS_TOKEN;
  }

  // Estrategia 2: Service Principal (producción)
  console.log("✓ Obteniendo token de Service Principal...");
  return await getServicePrincipalToken();
}

// Cache de token para evitar múltiples requests
let cachedToken: {
  token: string;
  expiresAt: number;
} | null = null;

export async function getCachedAccessToken(): Promise<string> {
  const now = Date.now();

  if (
    cachedToken &&
    cachedToken.expiresAt > now + 60000 /* buffer de 1 min */
  ) {
    return cachedToken.token;
  }

  const token = await getAccessToken();
  cachedToken = {
    token,
    expiresAt: now + 3600000, // 1 hora
  };

  return token;
}
