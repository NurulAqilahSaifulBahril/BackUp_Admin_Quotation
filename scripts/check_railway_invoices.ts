import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { gte } from 'drizzle-orm';

const connectionString = "postgresql://postgres:tkaYtCcfkqfsWKjQguFMqIcANbJNcNZA@shinkansen.proxy.rlwy.net:34999/railway";
const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function run() {
  console.log("Checking Railway production database for invoices since 2026-05-26...");
  try {
    const data = await db.select({
      id: schema.invoices.id,
      bubble_id: schema.invoices.bubble_id,
      invoice_number: schema.invoices.invoice_number,
      total_amount: schema.invoices.total_amount,
      invoice_date: schema.invoices.invoice_date,
      created_at: schema.invoices.created_at,
      updated_at: schema.invoices.updated_at
    })
    .from(schema.invoices)
    .where(gte(schema.invoices.invoice_date, new Date("2026-05-26")))
    .orderBy(schema.invoices.invoice_date);

    console.log(`Found ${data.length} invoices since 2026-05-26 on Railway:`);
    for (const inv of data) {
      console.log(`- ID: ${inv.id}, Bubble ID: ${inv.bubble_id}, Invoice No: ${inv.invoice_number}, Date: ${inv.invoice_date ? new Date(inv.invoice_date).toISOString() : 'N/A'}, Created At: ${inv.created_at ? new Date(inv.created_at).toISOString() : 'N/A'}, Updated At: ${inv.updated_at ? new Date(inv.updated_at).toISOString() : 'N/A'}`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

run();
