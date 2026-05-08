-- Migration: copy-invoice-edit-history-to-audit-log.sql
-- Backfills all EE-Admin invoice edit logs into invoice_audit_log
-- so that Agent OS invoiceHistoryRepo.js can surface them per invoice.
--
-- How invoiceHistoryRepo.js matches rows:
--   familyIds = [invoice bubble_ids]      → matched via entity_id WHERE entity_type='invoice'
--   itemIds   = [invoice_item bubble_ids] → matched via entity_id WHERE entity_type='invoice_item'
--
-- invoice_edit_history.entity_id already stores the correct bubble_ids, so no transform needed.
-- Column rename: edited_by_* → actor_*, source_app set to 'ee-admin'.
--
-- Idempotent: safe to re-run.

INSERT INTO invoice_audit_log (
    invoice_id,
    invoice_number,
    entity_type,
    entity_id,
    action_type,
    changes,
    actor_name,
    actor_phone,
    actor_user_id,
    actor_role,
    source_app,
    edited_at
)
SELECT
    h.invoice_id,
    h.invoice_number,
    h.entity_type,
    h.entity_id,        -- bubble_id of invoice or invoice_item (what invoiceHistoryRepo.js matches on)
    h.action_type,
    h.changes,          -- jsonb array [{field, before, after}] — identical shape, no transform needed
    h.edited_by_name,
    h.edited_by_phone,
    h.edited_by_user_id,
    h.edited_by_role,
    'ee-admin',
    h.edited_at
FROM invoice_edit_history h
WHERE NOT EXISTS (
    SELECT 1
    FROM   invoice_audit_log a
    WHERE  a.source_app = 'ee-admin'
      AND  a.invoice_id = h.invoice_id
      AND  a.edited_at  = h.edited_at
      AND  a.entity_id  IS NOT DISTINCT FROM h.entity_id
);
