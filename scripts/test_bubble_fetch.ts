import { BUBBLE_BASE_URL, BUBBLE_API_HEADERS } from "../src/lib/bubble/client";

async function run() {
  console.log("Fetching latest invoices from Bubble by Modified Date...");
  try {
    const url = `${BUBBLE_BASE_URL}/invoice?limit=10&sort_field=Modified Date&descending=true`;
    console.log("URL:", url);
    const response = await fetch(url, { headers: BUBBLE_API_HEADERS });
    if (!response.ok) {
      throw new Error(`Bubble API error: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    const results = data.response.results || [];
    console.log(`Successfully fetched ${results.length} invoices!`);
    for (const inv of results) {
      console.log(`- ID: ${inv._id}, Created: ${inv["Created Date"]}, Modified: ${inv["Modified Date"]}, Invoice No: ${inv["Invoice Number"] || inv["invoice_number"]}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
