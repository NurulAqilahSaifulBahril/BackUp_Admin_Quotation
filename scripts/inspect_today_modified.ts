import { BUBBLE_BASE_URL, BUBBLE_API_HEADERS } from "../src/lib/bubble/client";

async function run() {
  const ids = [
    "1709527829471x506743598417444860",
    "1711685855042x646472108878594000",
    "1720606189691x548715938780807200",
    "1765327656638x924139746623488000"
  ];
  
  console.log("Checking details of today's modified Bubble invoices...");
  try {
    for (const id of ids) {
      const response = await fetch(`${BUBBLE_BASE_URL}/invoice/${id}`, { headers: BUBBLE_API_HEADERS });
      if (!response.ok) {
        console.error(`Failed to fetch ${id}`);
        continue;
      }
      const data = await response.json();
      const inv = data.response;
      console.log(`\nID: ${id}`);
      console.log(`- Invoice Number: ${inv["Invoice Number"] || inv["invoice_number"]}`);
      console.log(`- Invoice Date: ${inv["Invoice Date"]}`);
      console.log(`- Created Date: ${inv["Created Date"]}`);
      console.log(`- Modified Date: ${inv["Modified Date"]}`);
      console.log(`- Total Amount: ${inv["Total Amount"] || inv["Amount"]}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
