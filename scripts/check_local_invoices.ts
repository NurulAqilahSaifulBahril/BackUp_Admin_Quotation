import * as fs from "fs";
import * as path from "path";

// Manually load .env file
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = value;
    }
  }
}

async function run() {
  console.log("Checking local database for latest invoices...");
  try {
    const { db } = await import("../src/lib/db");
    const { invoices } = await import("../src/db/schema");
    const { desc } = await import("drizzle-orm");

    const data = await db.select({
      id: invoices.id,
      bubble_id: invoices.bubble_id,
      invoice_number: invoices.invoice_number,
      total_amount: invoices.total_amount,
      invoice_date: invoices.invoice_date,
      created_at: invoices.created_at,
      updated_at: invoices.updated_at
    })
    .from(invoices)
    .orderBy(desc(invoices.created_at))
    .limit(10);

    console.log("Latest 10 invoices in local DB:");
    for (const inv of data) {
      console.log(`- ID: ${inv.id}, Bubble ID: ${inv.bubble_id}, Invoice No: ${inv.invoice_number}, Date: ${inv.invoice_date ? new Date(inv.invoice_date).toISOString() : 'N/A'}, Created At: ${inv.created_at ? new Date(inv.created_at).toISOString() : 'N/A'}, Updated At: ${inv.updated_at ? new Date(inv.updated_at).toISOString() : 'N/A'}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

run().then(() => process.exit(0));
