import { config } from "../config.js";
import { getCachedAccessToken } from "../auth/azure.js";

// ============================================================================
// Tipos y Interfaces
// ============================================================================

interface McpServerConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  auth?: {
    type: "bearer";
    token: string;
  };
}

interface McpServersConfig {
  [key: string]: McpServerConfig;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface InitializeParams {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: {
    name: string;
    version: string;
  };
}

interface InitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: {
    name: string;
    version: string;
  };
}

interface ToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
  isError: boolean;
}

// ============================================================================
// FabricMcpClient - Clase principal para interactuar con MCP de Fabric
// ============================================================================

export class FabricMcpClient {
  private requestId: number = 1;
  private initialized: boolean = false;

  private getNextId(): number {
    return this.requestId++;
  }

  /**
   * Hace un request genérico JSON-RPC 2.0 al servidor MCP
   */
  private async callMcpMethod<T>(
    method: string,
    params: Record<string, unknown>
  ): Promise<JsonRpcResponse<T>> {
    try {
      const token = await getCachedAccessToken();

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: this.getNextId(),
        method,
        params,
      };

      const response = await fetch(config.FABRIC_MCP_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as JsonRpcResponse<T>;

      if (data.error) {
        throw new Error(
          `RPC Error ${data.error.code}: ${data.error.message}`
        );
      }

      return data;
    } catch (error) {
      throw new Error(
        `MCP call failed (${method}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Inicializa la conexión con el servidor MCP
   */
  async initialize(): Promise<InitializeResult> {
    try {
      const response = await this.callMcpMethod<InitializeResult>(
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "AgentTickets3B",
            version: "1.0.0",
          },
        }
      );

      if (!response.result) {
        throw new Error("No initialization result from server");
      }

      this.initialized = true;
      return response.result;
    } catch (error) {
      throw new Error(
        `Failed to initialize MCP: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Hace una consulta al DataAgent_TKTAgent
   * @param userQuestion La pregunta en lenguaje natural
   * @returns La respuesta del agente como string
   */
  async query(userQuestion: string): Promise<string> {
    if (!this.initialized) {
      throw new Error(
        "MCP not initialized. Call initialize() first."
      );
    }

    try {
      const response = await this.callMcpMethod<ToolCallResult>(
        "tools/call",
        {
          name: "DataAgent_TKTAgent",
          arguments: {
            userQuestion,
          },
        }
      );

      if (!response.result) {
        throw new Error("No result from tool call");
      }

      // Extraer el texto de la respuesta
      const result = response.result;
      if (result.isError) {
        throw new Error("Tool returned an error");
      }

      // Buscar el contenido de texto en la respuesta
      const textContent = result.content.find((c) => c.type === "text");
      if (!textContent || !textContent.text) {
        throw new Error("No text content in tool response");
      }

      return textContent.text;
    } catch (error) {
      throw new Error(
        `Query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Hace múltiples consultas en secuencia
   */
  async queryBatch(questions: string[]): Promise<string[]> {
    const results: string[] = [];

    for (const question of questions) {
      const result = await this.query(question);
      results.push(result);
    }

    return results;
  }
}

// ============================================================================
// Singleton Instance y Factory Functions
// ============================================================================

let fabricClient: FabricMcpClient | null = null;

/**
 * Obtiene o crea la instancia singleton del cliente
 */
export async function getFabricClient(): Promise<FabricMcpClient> {
  if (!fabricClient) {
    fabricClient = new FabricMcpClient();
    await fabricClient.initialize();
  }
  return fabricClient;
}

/**
 * Resetea la instancia del cliente (útil para tests)
 */
export function resetFabricClient(): void {
  fabricClient = null;
}

// ============================================================================
// Configuración para Claude Agent SDK
// ============================================================================

/**
 * Retorna la configuración MCP para el query() del Claude Agent SDK
 */
export async function getFabricMcpConfig(): Promise<McpServersConfig> {
  try {
    const token = await getCachedAccessToken();

    return {
      "fabric-data": {
        type: "http",
        url: config.FABRIC_MCP_URL,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to configure Fabric MCP: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// Compatibilidad backwards
// ============================================================================

/**
 * Consulta el Data Agent de Fabric (usando OpenAI-compatible endpoint)
 * @deprecated Usar FabricMcpClient.query() en su lugar
 */
export async function queryFabricAgent(prompt: string): Promise<string> {
  const client = await getFabricClient();
  return client.query(prompt);
}

interface FabricMessageRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  model?: string;
}

interface FabricMessageResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Consulta el endpoint OpenAI-compatible de Fabric
 * @deprecated Usar MCP en su lugar
 */
export async function queryFabricOpenAiEndpoint(
  prompt: string
): Promise<string> {
  try {
    const token = await getCachedAccessToken();

    const payload: FabricMessageRequest = {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const response = await fetch(config.FABRIC_OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Fabric API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FabricMessageResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from Fabric agent");
    }

    return data.choices[0].message.content;
  } catch (error) {
    throw new Error(
      `Failed to query Fabric agent: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
