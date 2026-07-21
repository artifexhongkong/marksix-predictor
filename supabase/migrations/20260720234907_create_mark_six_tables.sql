/*
# Create Mark Six (六合彩) prediction tables (single-tenant, no auth)

1. Purpose
   Store historical Mark Six draw results and generated predictions so the
   prediction engine can analyze past draws and so predictions can be saved
   for later comparison with actual results.

2. New Tables
   - `draws`: historical draw results
     - `id` (uuid, primary key)
     - `draw_number` (integer, unique draw identifier issued by the lottery)
     - `draw_date` (date, when the draw took place)
     - `numbers` (integer[6], the six winning numbers, 1-49, sorted ascending)
     - `special_number` (integer, the special/bonus number, 1-49)
     - `created_at` (timestamptz)
   - `predictions`: generated prediction sets
     - `id` (uuid, primary key)
     - `numbers` (integer[6], predicted six numbers, sorted ascending)
     - `special_number` (integer, predicted special number)
     - `method` (text, short label for the method/weights used)
     - `params` (jsonb, the engine parameters used to generate this set)
     - `target_draw_number` (integer, nullable, the draw this prediction targets)
     - `created_at` (timestamptz)
     - `hit_count` (integer, default 0, how many of the predicted numbers
       matched the actual draw once resolved)

3. Indexes
   - `draws_draw_number_idx` on `draws.draw_number` (unique lookups)
   - `draws_draw_date_idx` on `draws.draw_date` (range queries for windows)
   - `predictions_created_at_idx` on `predictions.created_at` (recent list)

4. Security
   - Enable RLS on both tables.
   - This is a single-tenant app with no sign-in screen, so the anon-key
     frontend must be able to read and write. Policies use `TO anon, authenticated`
     with `USING (true)` / `WITH CHECK (true)` because the data is intentionally
     shared/public (no per-user isolation needed).
*/

CREATE TABLE IF NOT EXISTS draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_number integer UNIQUE NOT NULL,
  draw_date date NOT NULL,
  numbers integer[6] NOT NULL,
  special_number integer NOT NULL CHECK (special_number BETWEEN 1 AND 49),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_draws" ON draws;
CREATE POLICY "anon_select_draws" ON draws FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_draws" ON draws;
CREATE POLICY "anon_insert_draws" ON draws FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_draws" ON draws;
CREATE POLICY "anon_update_draws" ON draws FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_draws" ON draws;
CREATE POLICY "anon_delete_draws" ON draws FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS draws_draw_number_idx ON draws (draw_number);
CREATE INDEX IF NOT EXISTS draws_draw_date_idx ON draws (draw_date);

CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numbers integer[6] NOT NULL,
  special_number integer NOT NULL CHECK (special_number BETWEEN 1 AND 49),
  method text NOT NULL DEFAULT 'weighted',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_draw_number integer,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_predictions" ON predictions;
CREATE POLICY "anon_select_predictions" ON predictions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_predictions" ON predictions;
CREATE POLICY "anon_insert_predictions" ON predictions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_predictions" ON predictions;
CREATE POLICY "anon_update_predictions" ON predictions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_predictions" ON predictions;
CREATE POLICY "anon_delete_predictions" ON predictions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS predictions_created_at_idx ON predictions (created_at);
