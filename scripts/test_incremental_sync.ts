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

import { BUBBLE_BASE_URL, BUBBLE_API_HEADERS } from "../src/lib/bubble/client";

async function run() {
  console.log("Starting diagnostic incremental sync...");
  try {
    // Dynamically import database and schema to avoid hoisting issues
    const { db } = await import("../src/lib/db");
    const { invoices } = await import("../src/db/schema");
    const { inArray } = await import("drizzle-orm");
    const { syncInvoiceWithFullIntegrity } = await import("../src/lib/integrity-sync");

    // 1. Fetch latest 30 invoices from Bubble
    const url = `${BUBBLE_BASE_URL}/invoice?limit=30&sort_field=Modified Date&descending=true`;
    console.log("Fetching from Bubble URL:", url);
    const response = await fetch(url, { headers: BUBBLE_API_HEADERS });
    if (!response.ok) {
      throw new Error(`Bubble API error: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    const bubbleInvoices = data.response.results || [];
    console.log(`Fetched ${bubbleInvoices.length} invoices from Bubble.`);

    if (bubbleInvoices.length === 0) {
      console.log("No invoices fetched from Bubble.");
      return;
    }

    const bubbleIds = bubbleInvoices.map((inv: any) => inv._id);

    // 2. Fetch corresponding local invoices
    const localInvoices = await db.select({
      bubble_id: invoices.bubble_id,
      updated_at: invoices.updated_at,
      invoice_number: invoices.invoice_number
    })
    .from(invoices)
    .where(inArray(invoices.bubble_id, bubbleIds));

    console.log(`Found ${localInvoices.length} matching invoices locally.`);

    const localMap = new Map(
      localInvoices.map((inv) => [inv.bubble_id, inv])
    );

    // 3. Compare and sync
    let syncCount = 0;
    for (const bInv of bubbleInvoices) {
      const bubbleId = bInv._id;
      const bubbleModified = new Date(bInv["Modified Date"]);
      const localInv = localMap.get(bubbleId);

      const needsSync = !localInv || !localInv.updated_at || new Date(localInv.updated_at) < bubbleModified;

      if (needsSync) {
        console.log(`\nInvoice ${bInv["Invoice Number"] || bInv._id} needs sync!`);
        if (!localInv) {
          console.log(`- Reason: Missing locally`);
        } else {
          console.log(`- Reason: Outdated (Bubble Modified: ${bubbleModified.toISOString()}, Local Updated: ${new Date(localInv.updated_at!).toISOString()})`);
        }

        console.log(`Syncing ${bubbleId} with full integrity...`);
        const result = await syncInvoiceWithFullIntegrity(bubbleId, {
          force: true,
          skipUsers: true,
          skipAgents: true
        });

        if (result.success) {
          console.log(`✅ Synced successfully!`);
          syncCount++;
        } else {
          console.error(`❌ Sync failed for ${bubbleId}:`, result.errors);
        }
      } else {
        console.log(`Invoice ${bInv["Invoice Number"] || bInv._id} is up-to-date (Local Updated: ${new Date(localInv.updated_at!).toISOString()})`);
      }
    }

    console.log(`\nIncremental sync test completed. Synced ${syncCount} invoices.`);
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

run().then(() => process.exit(0));
