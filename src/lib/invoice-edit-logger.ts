import { db } from "@/lib/db";
import { invoice_audit_log, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";

/**
 * Resolve the display name for the current user.
 * JWT may have an empty name — fall back to DB lookup by userId.
 */
export async function resolveActor(): Promise<{
  name: string;
  phone: string;
  userId: string;
  role: string;
}> {
  try {
    const user = await getUser();
    if (!user) return { name: 'System', phone: '', userId: 'system', role: 'system' };

    let name = user.name?.trim() || '';

    // JWT name is blank — look up in users table by userId (integer id)
    if (!name && user.userId && user.userId !== 'system') {
      try {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, parseInt(user.userId, 10)),
          columns: { name: true },
        });
        if (dbUser?.name) name = dbUser.name;
      } catch (_) {}
    }

    return {
      name: name || 'Unknown',
      phone: user.phone || '',
      userId: user.userId || '',
      role: user.role || '',
    };
  } catch (_) {
    return { name: 'System', phone: '', userId: 'system', role: 'system' };
  }
}

export type InvoiceEditLogParams = {
  invoiceId: number;
  invoiceNumber: string | null;
  entityType: "invoice" | "invoice_item";
  entityId: string | null;
  actionType: "create" | "update" | "delete";
  before: any;
  after: any;
  fields: string[];
};

export async function logInvoiceEdit(params: InvoiceEditLogParams) {
  try {
    const actor = await resolveActor();
    const editorName = actor.name;
    const editorId = actor.userId;
    const editorRole = actor.role;
    const editorPhone = actor.phone;

    // 2. Calculate the diff
    const changes: Array<{ field: string; before: any; after: any }> = [];

    if (params.actionType === "update") {
      for (const field of params.fields) {
        const beforeVal = params.before ? params.before[field] : null;
        const afterVal = params.after ? params.after[field] : null;

        // Simple strict equality check. For complex objects/arrays, you might need deep comparison
        if (String(beforeVal) !== String(afterVal)) {
           // Format values for display (e.g., handles null/undefined)
           const fmtBefore = beforeVal === null || beforeVal === undefined ? "—" : String(beforeVal);
           const fmtAfter = afterVal === null || afterVal === undefined ? "—" : String(afterVal);
           
           changes.push({
             field,
             before: fmtBefore,
             after: fmtAfter
           });
        }
      }
    } else if (params.actionType === "create") {
        // For creation, we just show what was set
        changes.push({
            field: "item",
            before: null,
            after: params.after?.description || "New Item"
        });
         // Add detailed fields if needed
         if (params.after?.amount) changes.push({ field: "amount", before: null, after: params.after.amount });
    } else if (params.actionType === "delete") {
        changes.push({
            field: "item",
            before: params.before?.description || "Item",
            after: null
        });
    }

    // Only log if there are actual changes or it's a create/delete action
    if (changes.length > 0 || params.actionType !== 'update') {
        await db.insert(invoice_audit_log).values({
            invoice_id: params.invoiceId,
            invoice_number: params.invoiceNumber,
            entity_type: params.entityType,
            entity_id: params.entityId,
            action_type: params.actionType,
            changes: changes,
            actor_name: editorName,
            actor_user_id: editorId,
            actor_role: editorRole,
            actor_phone: editorPhone,
            source_app: 'ee-admin',
            edited_at: new Date(),
        });
    }

  } catch (error) {
    console.error("Failed to log invoice edit:", error);
    // We don't throw here to avoid blocking the actual user action if logging fails
  }
}