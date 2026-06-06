import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY es requerido"),
  FABRIC_MCP_URL: z
    .string()
    .url("FABRIC_MCP_URL debe ser una URL válida"),
  FABRIC_OPENAI_URL: z
    .string()
    .url("FABRIC_OPENAI_URL debe ser una URL válida"),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_ACCESS_TOKEN: z.string().optional(),
  SENDGRID_API_KEY: z.string().min(1, "SENDGRID_API_KEY es requerido"),
  REPORT_FROM_EMAIL: z
    .string()
    .email("REPORT_FROM_EMAIL debe ser un email válido"),
  REPORT_RECIPIENTS: z.string().min(1, "REPORT_RECIPIENTS es requerido"),
  MODE: z
    .enum(["chat", "scheduled"])
    .optional()
    .default("chat"),
  LLM_MODEL: z
    .string()
    .default("claude-haiku-4-5-20251001"),
});

type Config = z.infer<typeof envSchema>;

function validateConfig(): Config {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Errores de configuración:");
    parsed.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  // Validar que al menos una estrategia de autenticación esté disponible
  if (!parsed.data.AZURE_ACCESS_TOKEN && !parsed.data.AZURE_CLIENT_ID) {
    console.error(
      "❌ Se requiere AZURE_ACCESS_TOKEN o credenciales de Service Principal (AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID)"
    );
    process.exit(1);
  }

  return parsed.data;
}

export const config = validateConfig();

export function getReportRecipients(): string[] {
  return config.REPORT_RECIPIENTS.split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}
