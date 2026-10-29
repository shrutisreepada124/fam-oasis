/*
# KinSync Health — care checklist log (single-tenant, no auth)

1. Purpose
   Stores per-day checkbox state for the Daily Care & Medication Checklist.
   The family profiles (Mom, Son, Grandma), recipes, and label data are static
   content baked into the frontend; only the checklist completion state is
   persisted so it survives reloads.

2. New Tables
   - `care_log`
     - `id` uuid primary key
     - `task_key` text NOT NULL — stable identifier of the care task (e.g. "mom_vitamin_d")
     - `date` date NOT NULL — the calendar day the checkbox belongs to
     - `completed` boolean NOT NULL default false
     - `completed_at` timestamptz nullable — when it was checked
     - `created_at` timestamptz default now()
   - Unique constraint on (task_key, date) so each task/day has one row.

3. Security
   - Single-tenant app with no sign-in → policies target `anon, authenticated`.
   - RLS enabled. CRUD granted to anon + authenticated.
   - USING (true) / WITH CHECK (true) is intentional: the data is intentionally
     shared/public within this single app instance.
*/

CREATE TABLE IF NOT EXISTS care_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT care_log_task_date_unique UNIQUE (task_key, date)
);

ALTER TABLE care_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON care_log TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_care_log" ON care_log;
CREATE POLICY "anon_select_care_log" ON care_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_care_log" ON care_log;
CREATE POLICY "anon_insert_care_log" ON care_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_care_log" ON care_log;
CREATE POLICY "anon_update_care_log" ON care_log FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_care_log" ON care_log;
CREATE POLICY "anon_delete_care_log" ON care_log FOR DELETE
  TO anon, authenticated USING (true);
