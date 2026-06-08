import { config } from "./config.js";
import { FabricMcpClient } from "./tools/fabric.js";
import { createAgentSDK } from "./agent/agent-sdk.js";

async function testAgentSDK() {
  console.log("🧪 Testing Agent SDK...\n");

  try {
    // Inicializar Fabric
    console.log("1️⃣  Initializing Fabric MCP Client...");
    const fabricClient = new FabricMcpClient();
    await fabricClient.initialize();
    console.log("   ✓ Fabric initialized\n");

    // Crear Agent SDK
    console.log("2️⃣  Creating Agent SDK...");
    const agentSDK = await createAgentSDK(fabricClient, {
      maxTurns: 3,
      maxTokens: 1024,
      onToolCall: (toolName, input) => {
        console.log(`   🔧 Tool call: ${toolName}`);
      },
      onToolResult: (toolName, result) => {
        const resultStr = typeof result === "string" ? result : JSON.stringify(result);
        console.log(`   ✓ ${toolName} result (${resultStr.length} chars)`);
      },
    });
    console.log("   ✓ Agent SDK created\n");

    // Test simple query
    console.log("3️⃣  Running test query...");
    const result = await agentSDK.query(
      "¿Cuántos tickets hay en total en el sistema? Responde de manera concisa."
    );
    console.log("   ✓ Query completed\n");

    console.log("📝 Response:");
    console.log("───────────────────────────────────────");
    console.log(result.response.substring(0, 500));
    if (result.response.length > 500) {
      console.log("... (truncated)");
    }
    console.log("───────────────────────────────────────\n");

    console.log("✅ Agent SDK test passed!");
  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testAgentSDK();
