CREATE TABLE fixed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fixed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON fixed_items FOR ALL USING (true) WITH CHECK (true);
