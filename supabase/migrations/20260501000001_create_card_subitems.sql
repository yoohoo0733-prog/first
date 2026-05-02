-- card_subitems: each row is one line-item inside a card's monthly bill
CREATE TABLE IF NOT EXISTS card_subitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_item_id uuid NOT NULL REFERENCES fixed_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE card_subitems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read card_subitems"
  ON card_subitems FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert card_subitems"
  ON card_subitems FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update card_subitems"
  ON card_subitems FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete card_subitems"
  ON card_subitems FOR DELETE TO anon USING (true);
