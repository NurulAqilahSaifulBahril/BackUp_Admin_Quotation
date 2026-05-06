-- Add indexes for SEDA registrations list query performance
-- These indexes prevent full table scans on the JOIN and filter columns

-- Index on seda_registration.bubble_id (used in JOIN with invoice.linked_seda_registration)
CREATE INDEX IF NOT EXISTS idx_seda_registration_bubble_id
  ON seda_registration (bubble_id);

-- GIN index on seda_registration.linked_invoice array (used in ANY() join condition)
CREATE INDEX IF NOT EXISTS idx_seda_registration_linked_invoice
  ON seda_registration USING GIN (linked_invoice);

-- Index on invoice.linked_seda_registration (used in JOIN with seda_registration.bubble_id)
CREATE INDEX IF NOT EXISTS idx_invoice_linked_seda_registration
  ON invoice (linked_seda_registration);

-- Index on invoice.percent_of_total_amount (used in WHERE >= 4 filter)
CREATE INDEX IF NOT EXISTS idx_invoice_percent_of_total_amount
  ON invoice (percent_of_total_amount);
