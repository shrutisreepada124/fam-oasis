/*
# FamOasis — scan history table (single-tenant, no auth)

1. Purpose
   Stores the history of label scans so users can revisit past scans
   and see what was checked when. The scan text and per-profile verdict
   are persisted; ingredient-level findings are recomputed on load.

2. New Tables
   - `scan_history`
     - `id` uuid primary key
     - `label_text` text NOT NULL — the pasted/ uploaded ingredient text
     - `label_name` text — optional friendly name (e.g. product name)
     - `overall` text NOT NULL — 'safe' | 'caution' | 'danger'
     - `scanned_at` timestamptz default now()

3. Security
   - Single-tenant app with no sign-in → policies target `anon, authenticated`.
   - RLS enabled. CRUD granted to anon + authenticated.
   - USING (true) / WITH CHECK (true) is intentional: shared/public data
     within this single app instance.
*/

CREATE TABLE IF NOT EXISTS scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_text text NOT NULL,
  label_name text,
  overall text NOT NULL DEFAULT 'safe',
  scanned_at timestamptz DEFAULT now()
);

ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON scan_history TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_scan_history" ON scan_history;
CREATE POLICY "anon_select_scan_history" ON scan_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scan_history" ON scan_history;
CREATE POLICY "anon_insert_scan_history" ON scan_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scan_history" ON scan_history;
CREATE POLICY "anon_update_scan_history" ON scan_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scan_history" ON scan_history;
CREATE POLICY "anon_delete_scan_history" ON scan_history FOR DELETE
  TO anon, authenticated USING (true);
