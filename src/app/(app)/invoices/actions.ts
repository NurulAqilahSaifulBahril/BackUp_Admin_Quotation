"use server";

import { db } from "@/lib/db";
import { invoices, agents, users, invoice_templates, customers, payments, invoice_items, invoice_edit_history, invoice_audit_log, packages, sedaRegistration } from "@/db/schema";
import { ilike, or, sql, desc, eq, and, inArray, gte, lte } from "drizzle-orm";
import { getInvoiceHtml } from "@/lib/invoice-renderer";
import { revalidatePath } from "next/cache";
import { syncCompleteInvoicePackage } from "@/lib/bubble";
import { logInvoiceEdit } from "@/lib/invoice-edit-logger";
import { syncInvoiceWithFullIntegrity } from "@/lib/integrity-sync";

const PDF_API_URL = "https://pdf-gen-production-6c81.up.railway.app";

export async function getInvoices(
  version: "v1" | "v2",
  search?: string,
  tab: "active" | "deleted" = "active",
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    paidPercentMin?: number;
    paidPercentMax?: number;
    dateFrom?: string;
    dateTo?: string;
    createdBy?: string;
  }
) {
  try {
    if (version === "v1") {
      const conditions = [
        sql`(${invoices.invoice_number} IS NULL OR ${invoices.invoice_number} = '')`,
        tab === "active" ? sql`COALESCE(${invoices.is_deleted}, false) = false` : sql`COALESCE(${invoices.is_deleted}, false) = true`
      ];

      if (search) {
        conditions.push(or(
          ilike(invoices.linked_customer, `%${search}%`),
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(agents.name, `%${search}%`),
          ilike(invoices.dealercode, `%${search}%`),
          sql`CAST(${invoices.invoice_id} AS TEXT) ILIKE ${`%${search}%`}`
        ) as any);
      }

      if (filters?.dateFrom) {
        conditions.push(gte(invoices.invoice_date, new Date(filters.dateFrom)));
      }
      if (filters?.dateTo) {
        conditions.push(lte(invoices.invoice_date, new Date(filters.dateTo)));
      }
      if (filters?.createdBy) {
        conditions.push(eq(invoices.created_by, filters.createdBy));
      }

      const whereClause = and(...conditions);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(invoices)
        .leftJoin(users, eq(invoices.created_by, users.bubble_id))
        .leftJoin(agents, eq(invoices.linked_agent, agents.bubble_id))
        .where(whereClause);

      const total = Number(count);

      const data = await db.select({
        id: invoices.id,
        invoice_id: invoices.invoice_id,
        amount: invoices.amount,
        invoice_date: invoices.invoice_date,
        linked_customer: invoices.linked_customer,
        invoice_by_user_name: users.name,
        invoice_by_user_email: users.email,
        agent_name: agents.name,
        dealercode: invoices.dealercode,
      })
        .from(invoices)
        .leftJoin(users, eq(invoices.created_by, users.bubble_id))
        .leftJoin(agents, eq(invoices.linked_agent, agents.bubble_id))
        .where(whereClause)
        .orderBy(desc(invoices.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { data, total, page, pageSize };
    } else {
      // v2 - Modern Invoices (Consolidated)
      
      // Quick incremental check on first page load to pull recently modified invoices from Bubble
      if (
        page === 1 &&
        tab === "active" &&
        !search &&
        !filters?.dateFrom &&
        !filters?.dateTo &&
        !filters?.createdBy &&
        !filters?.paidPercentMin &&
        !filters?.paidPercentMax
      ) {
        try {
          const { BUBBLE_BASE_URL, BUBBLE_API_HEADERS } = await import("@/lib/bubble");
          const url = `${BUBBLE_BASE_URL}/invoice?limit=30&sort_field=Modified Date&descending=true`;
          const response = await fetch(url, { headers: BUBBLE_API_HEADERS });
          if (response.ok) {
            const data = await response.json();
            const bubbleInvoices = data.response.results || [];
            if (bubbleInvoices.length > 0) {
              const bubbleIds = bubbleInvoices.map((inv: any) => inv._id);
              // Find matching local invoices
              const localInvoices = await db.select({
                bubble_id: invoices.bubble_id,
                updated_at: invoices.updated_at
              })
              .from(invoices)
              .where(inArray(invoices.bubble_id, bubbleIds));

              const localMap = new Map(localInvoices.map((inv) => [inv.bubble_id, inv]));

              for (const bInv of bubbleInvoices) {
                const bubbleId = bInv._id;
                const bubbleModified = new Date(bInv["Modified Date"]);
                const localInv = localMap.get(bubbleId);

                const needsSync = !localInv || !localInv.updated_at || new Date(localInv.updated_at) < bubbleModified;
                if (needsSync) {
                  console.log(`Incremental sync: invoice ${bubbleId} needs update...`);
                  // Sync this invoice with full integrity
                  await syncInvoiceWithFullIntegrity(bubbleId, {
                    force: true,
                    skipUsers: true,
                    skipAgents: true
                  });
                }
              }
            }
          }
        } catch (syncError) {
          console.error("Incremental auto-sync in getInvoices failed:", syncError);
        }
      }

      const searchCondition = search ? sql`AND (
        c.name ILIKE ${`%${search}%`}
        OR i.invoice_number ILIKE ${`%${search}%`}
        OR CAST(i.invoice_id AS TEXT) ILIKE ${`%${search}%`}
        OR u.name ILIKE ${`%${search}%`}
        OR u.email ILIKE ${`%${search}%`}
        OR a.name ILIKE ${`%${search}%`}
        OR a.email ILIKE ${`%${search}%`}
        OR CAST(i.created_by AS TEXT) ILIKE ${`%${search}%`}
      )` : sql``;

      const filterConditions: any[] = [];
      if (filters?.paidPercentMin !== undefined) {
        filterConditions.push(sql`AND CAST(i.percent_of_total_amount AS numeric) >= ${filters.paidPercentMin}`);
      }
      if (filters?.paidPercentMax !== undefined) {
        filterConditions.push(sql`AND CAST(i.percent_of_total_amount AS numeric) <= ${filters.paidPercentMax}`);
      }
      if (filters?.dateFrom) {
        filterConditions.push(sql`AND i.invoice_date >= ${new Date(filters.dateFrom).toISOString()}`);
      }
      if (filters?.dateTo) {
        filterConditions.push(sql`AND i.invoice_date <= ${new Date(filters.dateTo).toISOString()}`);
      }
      if (filters?.createdBy) {
        filterConditions.push(sql`AND i.created_by = ${filters.createdBy}`);
      }

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM invoice i
        LEFT JOIN customer c ON c.customer_id = i.linked_customer
        LEFT JOIN "user" u ON u.bubble_id = i.created_by
        LEFT JOIN agent a ON a.bubble_id = i.linked_agent
        WHERE i.is_latest = true
        AND COALESCE(i.is_deleted, false) = ${tab === 'active' ? false : true}
        ${searchCondition}
        ${sql.join(filterConditions, sql` `)}
      `);
      const total = Number(countResult.rows[0].count);

      const offset = (page - 1) * pageSize;
      const data = await db.execute(sql`
        SELECT
          i.id,
          i.invoice_id,
          i.invoice_number,
          i.total_amount,
          i.invoice_date,
          i.percent_of_total_amount,
          i.is_deleted,
          c.name as customer_name,
          COALESCE(u.name, u.email, a.name, a.email, i.created_by, i.linked_agent) as invoice_by_user_name,
          COALESCE(a.name, i.linked_agent) as agent_name
        FROM invoice i
        LEFT JOIN customer c ON c.customer_id = i.linked_customer
        LEFT JOIN "user" u ON u.bubble_id = i.created_by
        LEFT JOIN agent a ON a.bubble_id = i.linked_agent
        WHERE i.is_latest = true
        AND COALESCE(i.is_deleted, false) = ${tab === 'active' ? false : true}
        ${searchCondition}
        ${sql.join(filterConditions, sql` `)}
        ORDER BY i.created_at DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `);

      const processedData = data.rows.map((row: any) => ({
        id: row.id,
        invoice_id: row.invoice_id,
        invoice_number: row.invoice_number,
        total_amount: row.total_amount,
        invoice_date: row.invoice_date,
        percent_of_total_amount: row.percent_of_total_amount,
        is_deleted: row.is_deleted,
        customer_name_snapshot: row.customer_name || "N/A",
        invoice_by_user_name: row.invoice_by_user_name || "N/A",
        agent_name: row.agent_name || "N/A"
      }));

      return { data: processedData, total, page, pageSize };
    }
  } catch (error) {
    console.error("Database error in getInvoices:", error);
    throw error;
  }
}

export async function getInvoiceDetails(id: number, version: "v1" | "v2") {
  try {
    let invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });

    if (!invoice) return null;

    // Always pull the latest data from Bubble for this invoice on load
    if (invoice.bubble_id) {
      try {
        await syncInvoiceWithFullIntegrity(invoice.bubble_id, { force: true, skipUsers: true, skipAgents: true });
        // Re-query the updated invoice details from the local DB
        invoice = await db.query.invoices.findFirst({
          where: eq(invoices.id, id),
        }) || invoice;
      } catch (syncError) {
        console.error("Auto-sync on invoice load failed:", syncError);
      }
    }

    if (version === "v2" || invoice.invoice_number) {
      // Fetch all linked invoice items
      let items: any[] = [];
      if (invoice.linked_invoice_item && invoice.linked_invoice_item.length > 0) {
        items = await db.query.invoice_items.findMany({
          where: inArray(invoice_items.bubble_id, invoice.linked_invoice_item),
        });

        // Enrich items with package_type from the packages table
        const packageBubbleIds = items
          .filter((item) => item.linked_package)
          .map((item) => item.linked_package as string);

        if (packageBubbleIds.length > 0) {
          const linkedPackages = await db.query.packages.findMany({
            where: inArray(packages.bubble_id, packageBubbleIds),
            columns: { bubble_id: true, type: true, package_name: true },
          });

          const packageMap = new Map(linkedPackages.map((p) => [p.bubble_id, p]));
          items = items.map((item) => {
            if (item.linked_package && packageMap.has(item.linked_package)) {
              const pkg = packageMap.get(item.linked_package)!;
              return { ...item, package_type: pkg.type, package_name: pkg.package_name };
            }
            return item;
          });
        }
      }

      const template = await db.query.invoice_templates.findFirst({
        where: invoice.template_id
          ? eq(invoice_templates.bubble_id, invoice.template_id)
          : eq(invoice_templates.is_default, true),
      });

      // Get creator name
      let created_by_user_name = "System";
      if (invoice.created_by) {
        const creator = await db.query.users.findFirst({
          where: eq(users.bubble_id, invoice.created_by),
        });
        if (creator) {
          created_by_user_name = creator.name || creator.email || creator.bubble_id || "User";
        }
      }

      // Fetch customer data
      let customerData = null;
      if (invoice.linked_customer) {
        customerData = await db.query.customers.findFirst({
          where: eq(customers.customer_id, invoice.linked_customer),
        });
      }

      // Fetch all linked payments
      let paymentsData: any[] = [];
      if (invoice.linked_payment && invoice.linked_payment.length > 0) {
        paymentsData = await db.query.payments.findMany({
          where: inArray(payments.bubble_id, invoice.linked_payment),
        });
      }

      // Fetch SEDA registration to get customer signature
      let sedaRegistrationData = null;
      if (invoice.linked_seda_registration) {
        sedaRegistrationData = await db.query.sedaRegistration.findFirst({
          where: eq(sedaRegistration.bubble_id, invoice.linked_seda_registration),
        });
      }

      return {
        ...invoice,
        items,
        template,
        created_by_user_name,
        customer_data: customerData,
        customer_name_snapshot: customerData?.name || null,
        customer_address_snapshot: customerData?.address || null,
        customer_phone_snapshot: customerData?.phone || null,
        customer_email_snapshot: customerData?.email || null,
        linked_payments: paymentsData,
        seda_registration: sedaRegistrationData,
        total_payments: paymentsData.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      };
    } else {
      // v1 legacy - limited detail support for now
      return {
        id: invoice.id,
        invoice_id: invoice.invoice_id,
        invoice_number: `INV-${invoice.invoice_id}`,
        invoice_date: invoice.invoice_date instanceof Date ? invoice.invoice_date.toISOString().split('T')[0] : null,
        total_amount: invoice.amount,
        subtotal: invoice.amount,
        customer_name_snapshot: invoice.linked_customer,
        items: [
          {
            description: "Legacy Invoice Item",
            qty: 1,
            total_price: invoice.amount,
            item_type: "product"
          }
        ],
        template: await db.query.invoice_templates.findFirst({ where: eq(invoice_templates.is_default, true) }),
        created_by_user_name: "Legacy System",
        customer_data: null,
        linked_payments: [],
        total_payments: 0,
      };
    }
  } catch (error) {
    console.error("Database error in getInvoiceDetails:", error);
    throw error;
  }
}

export async function generateInvoicePdf(id: number, version: "v1" | "v2") {
  try {
    const details = await getInvoiceDetails(id, version);
    if (!details) throw new Error("Invoice not found");

    const html = getInvoiceHtml(details);

    const response = await fetch(`${PDF_API_URL}/api/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://admin.atap.solar",
        options: {
          format: "A4",
          printBackground: true,
          margin: {
            top: "0.5cm",
            right: "0.5cm",
            bottom: "0.5cm",
            left: "0.5cm",
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDF API error: ${errorText}`);
    }

    const data = await response.json();
    const pdfId = data.pdfId;

    if (!pdfId) {
      throw new Error("PDF ID not received from API");
    }

    return {
      pdfId,
      downloadUrl: `${PDF_API_URL}/api/download/${pdfId}`,
    };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
}

export async function deleteInvoice(id: number) {
  try {
    await db.update(invoices).set({ is_deleted: true, deleted_at: new Date() }).where(eq(invoices.id, id));
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return { success: false, error: String(error) };
  }
}

export async function recoverInvoice(id: number) {
  try {
    await db.update(invoices).set({ is_deleted: false, deleted_at: null }).where(eq(invoices.id, id));
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("Failed to recover invoice:", error);
    return { success: false, error: String(error) };
  }
}

export async function triggerInvoiceSync(dateFrom?: string, dateTo?: string) {
  try {
    const result = await syncCompleteInvoicePackage(dateFrom, dateTo);
    if (!result.success) {
      console.error("Invoice sync failed:", result.error);
      return { success: false, error: result.error };
    }

    revalidatePath("/invoices");
    return { success: true, results: result.results };
  } catch (error) {
    console.error("Error triggering invoice sync:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// INVOICE EDITOR SERVER ACTIONS
// ============================================================================

export async function updateInvoiceItem(
  itemId: number,
  data: { description?: string; qty?: number | string; unit_price?: number | string }
) {
  try {
    // Validate item exists
    const item = await db.query.invoice_items.findFirst({
      where: eq(invoice_items.id, itemId),
    });

    if (!item) {
      return { success: false, error: "Invoice item not found" };
    }

    // Get invoice ID from item's linked_invoice
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.bubble_id, item.linked_invoice || ""),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found for this item" };
    }

    // Calculate amount from qty and unit_price
    const qtyValue = data.qty !== undefined ? parseFloat(String(data.qty)) : parseFloat(String(item.qty || 0));
    const unitPriceValue = data.unit_price !== undefined ? parseFloat(String(data.unit_price)) : parseFloat(String(item.unit_price || 0));
    const amountValue = qtyValue * unitPriceValue;

    // Update item
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.description !== undefined) updateData.description = data.description;
    if (data.qty !== undefined) updateData.qty = qtyValue.toString();
    if (data.unit_price !== undefined) updateData.unit_price = unitPriceValue.toString();
    updateData.amount = amountValue.toString();

    const updatedItem = await db
      .update(invoice_items)
      .set(updateData)
      .where(eq(invoice_items.id, itemId))
      .returning();

    if (updatedItem.length === 0) {
      return { success: false, error: "Failed to update invoice item" };
    }

    // Recalculate invoice total
    await recalculateInvoiceTotal(invoice.id);

    // Log edit history
    await logInvoiceEdit({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      entityType: "invoice_item",
      entityId: item.bubble_id,
      actionType: "update",
      before: item,
      after: updatedItem[0],
      fields: ["description", "qty", "unit_price", "amount"],
    });

    revalidatePath("/invoices");
    return { success: true, item: updatedItem[0] };
  } catch (error) {
    console.error("Error updating invoice item:", error);
    return { success: false, error: String(error) };
  }
}

export async function recalculateInvoiceTotal(invoiceId: number) {
  try {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (!invoice.linked_invoice_item || invoice.linked_invoice_item.length === 0) {
      // No items, set total to 0
      await db
        .update(invoices)
        .set({ total_amount: "0", updated_at: new Date() })
        .where(eq(invoices.id, invoiceId));
      return { success: true, total: 0 };
    }

    // Get all linked items and sum their amounts
    const items = await db.query.invoice_items.findMany({
      where: inArray(invoice_items.bubble_id, invoice.linked_invoice_item),
    });

    let total = 0;
    for (const item of items) {
      if (item.amount) {
        total += parseFloat(item.amount.toString());
      }
    }

    // Update invoice total
    await db
      .update(invoices)
      .set({ total_amount: total.toString(), updated_at: new Date() })
      .where(eq(invoices.id, invoiceId));

    revalidatePath("/invoices");
    return { success: true, total };
  } catch (error) {
    console.error("Error recalculating invoice total:", error);
    return { success: false, error: String(error) };
  }
}

export async function createInvoiceItem(
  invoiceId: number,
  data: { description: string; qty: number | string; unit_price: number | string }
) {
  try {
    // Validate input
    if (!data.description || !data.description.trim()) {
      return { success: false, error: "Description is required" };
    }

    const qtyValue = parseFloat(String(data.qty));
    const unitPriceValue = parseFloat(String(data.unit_price));

    if (isNaN(qtyValue) || qtyValue <= 0) {
      return { success: false, error: "Quantity must be greater than 0" };
    }

    if (isNaN(unitPriceValue)) {
      return { success: false, error: "Unit price must be a valid number" };
    }

    // Get invoice
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (!invoice.bubble_id) {
      return { success: false, error: "Invoice missing bubble_id" };
    }

    // Generate bubble_id
    const bubbleId = `${Date.now()}x${Math.random().toString().slice(2, 20)}`;

    // Calculate amount
    const amountValue = qtyValue * unitPriceValue;

    // Get max sort value for ordering
    const existingItems = await db.query.invoice_items.findMany({
      where: inArray(invoice_items.bubble_id, invoice.linked_invoice_item || []),
    });
    const maxSort = existingItems.reduce((max, item) => {
      const sort = item.sort ? parseFloat(item.sort.toString()) : 0;
      return Math.max(max, sort);
    }, 0);

    // Create new item
    const newItem = await db
      .insert(invoice_items)
      .values({
        bubble_id: bubbleId,
        description: data.description.trim(),
        qty: qtyValue.toString(),
        unit_price: unitPriceValue.toString(),
        amount: amountValue.toString(),
        linked_invoice: invoice.bubble_id,
        sort: (maxSort + 1).toString(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (newItem.length === 0) {
      return { success: false, error: "Failed to create invoice item" };
    }

    // Update invoice: Add new bubble_id to linked_invoice_item array
    const currentItems = invoice.linked_invoice_item || [];
    await db
      .update(invoices)
      .set({
        linked_invoice_item: [...currentItems, bubbleId],
        updated_at: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // Recalculate invoice total
    await recalculateInvoiceTotal(invoiceId);

    // Log edit history
    await logInvoiceEdit({
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      entityType: "invoice_item",
      entityId: bubbleId,
      actionType: "create",
      before: null,
      after: newItem[0],
      fields: ["description", "qty", "unit_price", "amount"],
    });

    revalidatePath("/invoices");
    return { success: true, item: newItem[0] };
  } catch (error) {
    console.error("Error creating invoice item:", error);
    return { success: false, error: String(error) };
  }
}

export async function deleteInvoiceItem(itemId: number, invoiceId: number) {
  try {
    // Get item
    const item = await db.query.invoice_items.findFirst({
      where: eq(invoice_items.id, itemId),
    });

    if (!item) {
      return { success: false, error: "Invoice item not found" };
    }

    // Get invoice
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Delete item
    await db.delete(invoice_items).where(eq(invoice_items.id, itemId));

    // Update invoice: Remove bubble_id from linked_invoice_item array
    const currentItems = invoice.linked_invoice_item || [];
    const updatedItems = currentItems.filter((id) => id !== item.bubble_id);

    await db
      .update(invoices)
      .set({
        linked_invoice_item: updatedItems,
        updated_at: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // Recalculate invoice total
    await recalculateInvoiceTotal(invoiceId);

    // Log edit history
    await logInvoiceEdit({
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      entityType: "invoice_item",
      entityId: item.bubble_id,
      actionType: "delete",
      before: item,
      after: null,
      fields: ["description", "qty", "unit_price", "amount"],
    });

    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("Error deleting invoice item:", error);
    return { success: false, error: String(error) };
  }
}

export async function updateInvoiceAgent(invoiceId: number, agentBubbleId: string) {
  try {
    // Get current invoice state (for edit history)
    const currentInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!currentInvoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Resolve old agent name
    let oldAgentName: string | null = null;
    if (currentInvoice.linked_agent) {
      const oldAgent = await db.query.agents.findFirst({
        where: eq(agents.bubble_id, currentInvoice.linked_agent),
      });
      oldAgentName = oldAgent?.name || null;
    }

    // Validate new agent exists
    const agent = await db.query.agents.findFirst({
      where: eq(agents.bubble_id, agentBubbleId),
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Update invoice
    const updated = await db
      .update(invoices)
      .set({
        linked_agent: agentBubbleId,
        updated_at: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (updated.length === 0) {
      return { success: false, error: "Failed to update invoice" };
    }

    // Log edit history
    await logInvoiceEdit({
      invoiceId,
      invoiceNumber: currentInvoice.invoice_number,
      entityType: "invoice",
      entityId: currentInvoice.bubble_id,
      actionType: "update",
      before: { linked_agent: currentInvoice.linked_agent, agent_name: oldAgentName },
      after: { linked_agent: agentBubbleId, agent_name: agent.name },
      fields: ["linked_agent", "agent_name"],
    });

    revalidatePath("/invoices");
    return { success: true, invoice: updated[0] };
  } catch (error) {
    console.error("Error updating invoice agent:", error);
    return { success: false, error: String(error) };
  }
}

export async function getAgentsForSelection() {
  try {
    const agentsList = await db.query.agents.findMany({
      columns: {
        id: true,
        bubble_id: true,
        name: true,
      },
      orderBy: (agents, { asc }) => [asc(agents.name)],
    });

    return {
      success: true,
      agents: agentsList.map((agent) => ({
        id: agent.id,
        bubble_id: agent.bubble_id || "",
        name: agent.name || "Unnamed Agent",
      })),
    };
  } catch (error) {
    console.error("Error fetching agents:", error);
    return { success: false, error: String(error), agents: [] };
  }
}

export async function getInvoiceEditHistory(invoiceId: number) {
  try {
    const rows = await db
      .select()
      .from(invoice_audit_log)
      .where(eq(invoice_audit_log.invoice_id, invoiceId))
      .orderBy(desc(invoice_audit_log.edited_at));

    const history = rows.map((row) => ({
      id: row.id,
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      action_type: row.action_type,
      changes: row.changes,
      edited_by_name: row.actor_name,
      edited_by_phone: row.actor_phone,
      edited_by_user_id: row.actor_user_id,
      edited_by_role: row.actor_role,
      source_app: row.source_app,
      edited_at: row.edited_at,
    }));

    return { success: true, history };
  } catch (error) {
    console.error("Error fetching invoice edit history:", error);
    return { success: false, error: String(error), history: [] };
  }
}

export async function updateInvoiceWithEppFees(
  invoiceId: number,
  fees: { description: string; amount: number }[]
) {
  try {
    // 1. Get invoice details
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice || !invoice.bubble_id) {
      return { success: false, error: "Invoice not found or missing bubble_id" };
    }

    // 2. Identify and delete existing EPP fee items
    // We assume items with 'epp_fee' type or specific description pattern are EPP fees
    const existingItems = await db.query.invoice_items.findMany({
      where: inArray(invoice_items.bubble_id, invoice.linked_invoice_item || []),
    });

    const feeItemsToDelete = existingItems.filter(
      (item) => item.inv_item_type === "epp_fee" || item.description?.startsWith("EPP Processing Fee")
    );

    if (feeItemsToDelete.length > 0) {
      await db.delete(invoice_items).where(
        inArray(
          invoice_items.id,
          feeItemsToDelete.map((i) => i.id)
        )
      );
    }

    // 3. Create new EPP fee items
    const newFeeItems = [];
    // Get current max sort order
    const maxSort = existingItems.reduce((max, item) => {
      const sort = item.sort ? parseFloat(item.sort.toString()) : 0;
      return Math.max(max, sort);
    }, 0);

    let currentSort = maxSort;

    for (const fee of fees) {
      currentSort++;
      const bubbleId = `${Date.now()}x${Math.random().toString().slice(2, 20)}`; // Generate ID

      const newItem = await db
        .insert(invoice_items)
        .values({
          bubble_id: bubbleId,
          description: fee.description,
          qty: "1",
          unit_price: fee.amount.toString(),
          amount: fee.amount.toString(),
          linked_invoice: invoice.bubble_id,
          inv_item_type: "epp_fee", // Mark as EPP fee
          sort: currentSort.toString(),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      newFeeItems.push(newItem[0]);
    }

    // 4. Update invoice with new linked items
    const nonFeeItemIds = existingItems
      .filter((item) => !feeItemsToDelete.find((f) => f.id === item.id))
      .map((item) => item.bubble_id); // Keep existing non-fee items

    const newFeeItemIds = newFeeItems.map((item) => item.bubble_id);

    // Combine IDs (cast to string to fix type error if needed, but bubble_id is string)
    const updatedLinkedItems = [...nonFeeItemIds, ...newFeeItemIds] as string[];

    await db
      .update(invoices)
      .set({
        linked_invoice_item: updatedLinkedItems,
        updated_at: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // 5. Recalculate total
    await recalculateInvoiceTotal(invoiceId);

    // 6. Log this batch update
    await logInvoiceEdit({
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      entityType: "invoice",
      entityId: invoice.bubble_id,
      actionType: "update",
      before: { epp_fee_count: feeItemsToDelete.length },
      after: { epp_fee_count: newFeeItems.length, added_fees: fees },
      fields: ["epp_fees"],
    });

    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    console.error("Error updating invoice EPP fees:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// PACKAGE SWITCHING — Search & Switch
// ============================================================================

export async function searchPackagesForSwitch(query: {
  panel_watt?: string;
  panel_qty?: string;
  type?: string;
  search?: string;
}) {
  try {
    const conditions: any[] = [eq(packages.active, true)];

    // Generic keyword search (package_name or invoice_desc)
    if (query.search?.trim()) {
      conditions.push(
        or(
          ilike(packages.package_name, `%${query.search.trim()}%`),
          ilike(packages.invoice_desc, `%${query.search.trim()}%`)
        )
      );
    }

    // Panel watt / model (search in panel ID, package_name, and invoice_desc)
    if (query.panel_watt?.trim()) {
      const watt = query.panel_watt.trim();
      conditions.push(
        or(
          ilike(packages.panel, `%${watt}%`),
          ilike(packages.package_name, `%${watt}%`),
          ilike(packages.invoice_desc, `%${watt}%`)
        )
      );
    }

    // Number of panels (exact match)
    if (query.panel_qty?.trim()) {
      const qty = parseInt(query.panel_qty.trim(), 10);
      if (!isNaN(qty)) {
        conditions.push(eq(packages.panel_qty, qty));
      }
    }

    // Package type (residential / tariff)
    if (query.type?.trim() && query.type.trim() !== "all") {
      conditions.push(ilike(packages.type, `%${query.type.trim()}%`));
    }

    const results = await db
      .select({
        id: sql<number>`CAST(${packages.id} AS INTEGER)`,
        bubble_id: packages.bubble_id,
        package_name: packages.package_name,
        invoice_desc: packages.invoice_desc,
        panel: packages.panel,
        panel_qty: sql<number>`CAST(${packages.panel_qty} AS INTEGER)`,
        price: sql<string>`CAST(${packages.price} AS TEXT)`,
        type: packages.type,
      })
      .from(packages)
      .where(and(...conditions))
      .orderBy(desc(packages.id))
      .limit(50);

    // Final safety check: ensure everything is a plain serializable object
    const serializedPackages = results.map(p => ({
      id: Number(p.id),
      bubble_id: String(p.bubble_id || ""),
      package_name: String(p.package_name || ""),
      invoice_desc: String(p.invoice_desc || ""),
      panel: String(p.panel || ""),
      panel_qty: p.panel_qty ? Number(p.panel_qty) : null,
      price: String(p.price || "0"),
      type: String(p.type || ""),
    }));

    return { success: true, packages: serializedPackages };
  } catch (error) {
    console.error("Error searching packages:", error);
    return { success: false, error: String(error), packages: [] };
  }
}

export async function switchInvoiceItemPackage(
  itemId: number,
  newPackageBubbleId: string
) {
  try {
    // 1. Get the invoice item
    const item = await db.query.invoice_items.findFirst({
      where: eq(invoice_items.id, itemId),
    });

    if (!item) {
      return { success: false, error: "Invoice item not found" };
    }

    if (!item.is_a_package) {
      return { success: false, error: "This item is not a package item" };
    }

    // 2. Get the target package
    const targetPackage = await db.query.packages.findFirst({
      where: eq(packages.bubble_id, newPackageBubbleId),
    });

    if (!targetPackage) {
      return { success: false, error: "Package not found" };
    }

    // 3. Get the invoice for total recalculation & history logging
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.bubble_id, item.linked_invoice || ""),
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found for this item" };
    }

    // 4. Calculate new amount (keep existing qty, new unit_price from package)
    const qtyValue = parseFloat(String(item.qty || 1));
    const newUnitPrice = parseFloat(String(targetPackage.price || 0));
    const newAmount = qtyValue * newUnitPrice;

    // 5. Update the invoice item
    const updatedItem = await db
      .update(invoice_items)
      .set({
        description: targetPackage.invoice_desc || targetPackage.package_name || "",
        unit_price: newUnitPrice.toString(),
        amount: newAmount.toString(),
        linked_package: newPackageBubbleId,
        updated_at: new Date(),
      })
      .where(eq(invoice_items.id, itemId))
      .returning();

    if (updatedItem.length === 0) {
      return { success: false, error: "Failed to update invoice item" };
    }

    // 6. Recalculate invoice total
    await recalculateInvoiceTotal(invoice.id);

    // 7. Log audit history
    await logInvoiceEdit({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      entityType: "invoice_item",
      entityId: item.bubble_id,
      actionType: "update",
      before: {
        linked_package: item.linked_package,
        description: item.description,
        unit_price: item.unit_price,
        amount: item.amount,
      },
      after: {
        linked_package: newPackageBubbleId,
        package_name: targetPackage.package_name,
        description: targetPackage.invoice_desc,
        unit_price: newUnitPrice,
        amount: newAmount,
      },
      fields: ["linked_package", "description", "unit_price", "amount"],
    });

    revalidatePath("/invoices");
    return { success: true, item: updatedItem[0] };
  } catch (error) {
    console.error("Error switching invoice item package:", error);
    return { success: false, error: String(error) };
  }
}

export async function getUsersForFilter() {
  try {
    const usersList = await db
      .select({
        bubble_id: users.bubble_id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .orderBy(users.name);

    return usersList.filter((u) => u.bubble_id);
  } catch (error) {
    console.error("Error fetching users for filter:", error);
    return [];
  }
}

// ============================================================================
// CREATE NEW INVOICE
// ============================================================================

export async function getCustomersForInvoice(search?: string) {
  try {
    const conditions: any[] = [];
    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(customers.name, `%${search.trim()}%`),
          ilike(customers.email, `%${search.trim()}%`),
          ilike(customers.phone, `%${search.trim()}%`)
        )
      );
    }

    const result = await db
      .select({
        customer_id: customers.customer_id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        address: customers.address,
      })
      .from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(customers.name)
      .limit(50);

    return { success: true, customers: result };
  } catch (error) {
    console.error("Error fetching customers for invoice:", error);
    return { success: false, error: String(error), customers: [] };
  }
}

export async function createInvoice(data: {
  customer_id: string;
  invoice_date: string;
  notes?: string;
  created_by_bubble_id?: string;
}) {
  try {
    if (!data.customer_id) {
      return { success: false, error: "Customer is required" };
    }
    if (!data.invoice_date) {
      return { success: false, error: "Invoice date is required" };
    }

    // Validate the customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.customer_id, data.customer_id),
    });
    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Generate a new invoice number: INV-YYYYMMDD-XXXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 90000) + 10000;
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    // Generate a local bubble_id (won't sync to Bubble but keeps the schema consistent)
    const bubbleId = `local_${Date.now()}x${Math.random().toString(36).slice(2, 10)}`;

    // Get the highest invoice_id so far and increment
    const lastInvoice = await db
      .select({ invoice_id: invoices.invoice_id })
      .from(invoices)
      .orderBy(desc(invoices.invoice_id))
      .limit(1);
    const nextInvoiceId = lastInvoice.length > 0 && lastInvoice[0].invoice_id
      ? lastInvoice[0].invoice_id + 1
      : 1;

    // Get default template
    const template = await db.query.invoice_templates.findFirst({
      where: eq(invoice_templates.is_default, true),
    });

    const newInvoice = await db
      .insert(invoices)
      .values({
        bubble_id: bubbleId,
        invoice_id: nextInvoiceId,
        invoice_number: invoiceNumber,
        invoice_date: new Date(data.invoice_date),
        linked_customer: data.customer_id,
        total_amount: "0",
        amount: "0",
        percent_of_total_amount: "0",
        status: "Draft",
        is_latest: true,
        is_deleted: false,
        paid: false,
        linked_invoice_item: [],
        template_id: template?.bubble_id || null,
        created_by: data.created_by_bubble_id || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (newInvoice.length === 0) {
      return { success: false, error: "Failed to create invoice" };
    }

    revalidatePath("/invoices");
    return { success: true, invoice: newInvoice[0] };
  } catch (error) {
    console.error("Error creating invoice:", error);
    return { success: false, error: String(error) };
  }
}
