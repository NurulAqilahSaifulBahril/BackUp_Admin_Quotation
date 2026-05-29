import { BUBBLE_BASE_URL, BUBBLE_API_HEADERS } from "../src/lib/bubble/client";

async function run() {
  console.log("Checking Bubble for invoices from 2026-05-29...");
  try {
    const url = `${BUBBLE_BASE_URL}/invoice?limit=50&sort_field=Modified Date&descending=true`;
    const response = await fetch(url, { headers: BUBBLE_API_HEADERS });
    if (!response.ok) {
      throw new Error(`Bubble API error: ${response.statusText}`);
    }
    const data = await response.json();
    const results = data.response.results || [];
    
    console.log(`Fetched ${results.length} most recently modified invoices from Bubble:`);
    let todayCount = 0;
    for (const inv of results) {
      const created = inv["Created Date"];
      const modified = inv["Modified Date"];
      
      const isToday = created.startsWith("2026-05-29") || modified.startsWith("2026-05-29");
      if (isToday) {
        todayCount++;
        console.log(`[TODAY] ID: ${inv._id}, Created: ${created}, Modified: ${modified}, Invoice Number: ${inv["Invoice Number"] || inv["invoice_number"]}`);
      } else {
        console.log(`[OTHER] ID: ${inv._id}, Created: ${created}, Modified: ${modified}, Invoice Number: ${inv["Invoice Number"] || inv["invoice_number"]}`);
      }
    }
    console.log(`\nFound ${todayCount} invoices from 2026-05-29 in the top 50 Bubble records.`);
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
