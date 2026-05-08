import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sedaRegistration, invoices } from "@/db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";

/**
 * POST /api/maintenance/patch-seda-links
 *
 * Maintenance endpoint to patch missing links between invoices and SEDA registrations.
 *
 * This endpoint performs one patch:
 * 1. Backfill invoice.linked_seda_registration for invoices missing this link
 *
 * NOTE: The old Patch 2 (seda_registration.linked_customer) has been removed.
 * Customer is now always looked up via invoice.linked_customer.
 */
export async function POST(request: NextRequest) {
  try {
    const results = {
      invoicesPatched: 0,
      errors: [] as string[]
    };

    // ========================================================================
    // PATCH 1: Backfill invoice.linked_seda_registration
    // ========================================================================
    // Find invoices missing linked_seda_registration but their customer has SEDAs
    const invoicesNeedingPatch = await db
      .select({
        invoice_bubble_id: invoices.bubble_id,
        linked_customer: invoices.linked_customer,
        invoice_number: invoices.invoice_number,
      })
      .from(invoices)
      .where(
        and(
          isNull(invoices.linked_seda_registration),
          sql`CAST(${invoices.total_amount} AS FLOAT) > 0`,
          sql`${invoices.linked_customer} IS NOT NULL`
        )
      );

    // For each invoice, find the closest SEDA by timestamp
    for (const invoice of invoicesNeedingPatch) {
      try {
        // Find SEDAs for this customer, ordered by closest timestamp
        const matchingSedas = await db
          .select({
            seda_bubble_id: sedaRegistration.bubble_id,
            time_diff: sql`ABS(EXTRACT(EPOCH FROM (${sedaRegistration.created_at} - ${invoices.created_at})))`,
          })
          .from(sedaRegistration)
          .where(eq(sedaRegistration.linked_customer, invoice.linked_customer!))
          .orderBy(sql`ABS(EXTRACT(EPOCH FROM (${sedaRegistration.created_at} - (SELECT created_at FROM invoice WHERE bubble_id = ${invoice.invoice_bubble_id}))))`)
          .limit(1);

        if (matchingSedas.length > 0) {
          // Update the invoice with the SEDA link
          await db
            .update(invoices)
            .set({ linked_seda_registration: matchingSedas[0].seda_bubble_id })
            .where(eq(invoices.bubble_id, invoice.invoice_bubble_id!));

          results.invoicesPatched++;
        }
      } catch (err) {
        results.errors.push(`Invoice ${invoice.invoice_bubble_id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Patch error:', error);
    return NextResponse.json(
      {
        error: "Patch failed",
        message: error.message
      },
      { status: 500 }
    );
  }
}
