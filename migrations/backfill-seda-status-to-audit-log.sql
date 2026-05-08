-- Migration: backfill-seda-status-to-audit-log.sql
-- Creates one invoice_audit_log entry per invoice recording the current
-- seda_status from seda_registration.
--
-- entity_type = 'seda', entity_id = seda_registration.bubble_id
-- Timestamp = seda_registration.updated_at (falls back to created_at, then NOW())
-- Idempotent: skips any invoice that already has a seda/ee-admin audit row.

INSERT INTO invoice_audit_log
    (invoice_id, invoice_number, entity_type, entity_id,
     action_type, changes, source_app, edited_at)
SELECT
    i.id,
    i.invoice_number,
    'seda',
    sr.bubble_id,
    'update',
    jsonb_build_array(
        jsonb_build_object(
            'field', 'seda_status',
            'before', NULL,
            'after',  sr.seda_status
        )
    ),
    'ee-admin',
    COALESCE(sr.updated_at, sr.created_at, NOW())
FROM seda_registration sr
JOIN invoice i ON i.linked_seda_registration = sr.bubble_id
WHERE sr.seda_status IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM invoice_audit_log a
      WHERE  a.entity_type = 'seda'
        AND  a.source_app  = 'ee-admin'
        AND  a.invoice_id  = i.id
  );
