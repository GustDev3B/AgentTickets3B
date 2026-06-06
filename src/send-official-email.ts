import "dotenv/config";
import { sendReport } from "./tools/sendgrid.js";
import { getReportRecipients } from "./config.js";
import fs from "fs/promises";
import path from "path";

async function sendOfficialEmail() {
  try {
    const filePath = path.join(process.cwd(), "reports", "reporte-preview.html");

    console.log("📄 Leyendo reporte oficial...");
    console.log(`   Ruta: ${filePath}\n`);

    const htmlContent = await fs.readFile(filePath, "utf-8");

    const recipients = getReportRecipients();
    const subject = `📊 Reporte de Tickets - Tiendas 3B (${new Date().toLocaleDateString("es-BO")})`;

    console.log("🚀 Enviando reporte...\n");

    const result = await sendReport(htmlContent, subject, recipients);

    console.log("\n✅ Email enviado correctamente:");
    console.log(`   ${result.message}`);
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

sendOfficialEmail();
