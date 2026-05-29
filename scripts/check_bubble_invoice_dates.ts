import { BUBBLE_BASE_URL, BUBBLE_API_HEADERS } from "../src/lib/bubble/client";

async function run() {
  console.log("Checking Bubble for invoices with Invoice Date >= 2026-05-26...");
  try {
    const url = `${BUBBLE_BASE_URL}/invoice?limit=200&sort_field=Created Date&descending=true`;
    const response = await fetch(url, { headers: BUBBLE_API_HEADERS });
    if (!response.ok) {
      throw new Error(`Bubble API error: ${response.statusText}`);
    }
    const data = await response.json();
    const results = data.response.results || [];
    
    console.log(`Fetched ${results.length} invoices from Bubble (sorted by Created Date desc)`);
    
    const targetDate = new Date("2026-05-26");
    let matchCount = 0;
    
    for (const inv of results) {
      const invoiceDateStr = inv["Invoice Date"];
      if (!invoiceDateStr) continue;
      
      const invoiceDate = new Date(invoiceDateStr);
      if (invoiceDate >= targetDate) {
        matchCount++;
        console.log(`[MATCH] ID: ${inv._id}`);
        console.log(`  - Invoice No: ${inv["Invoice Number"] || inv["invoice_number"]}`);
        console.log(`  - Invoice Date: ${invoiceDateStr} (${invoiceDate.toISOString()})`);
        console.log(`  - Created Date: ${inv["Created Date"]}`);
        console.log(`  - Modified Date: ${inv["Modified Date"]}`);
        console.log(`  - Total Amount: ${inv["Total Amount"] || inv["Amount"]}`);
        console.log(`  - Customer: ${inv["Linked Customer"]}`);
      }
    }
    
    console.log(`\nFound ${matchCount} matching invoices in the top 200 Bubble records.`);
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
