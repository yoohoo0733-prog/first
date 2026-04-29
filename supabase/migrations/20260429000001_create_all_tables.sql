-- ============================================================
-- accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text        NOT NULL,
  balance bigint      NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select" ON accounts FOR SELECT TO anon USING (true);
CREATE POLICY "accounts_insert" ON accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "accounts_update" ON accounts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "accounts_delete" ON accounts FOR DELETE TO anon USING (true);

-- ============================================================
-- fixed_items
-- ============================================================
CREATE TABLE IF NOT EXISTS fixed_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  amount       bigint      NOT NULL,
  -- day_of_month is NULL when is_last_day = true
  day_of_month integer,
  is_last_day  boolean     NOT NULL DEFAULT false,
  type         text        NOT NULL CHECK (type IN ('income', 'expense')),
  account_id   uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fixed_items_day_of_month_check CHECK (
    (is_last_day = true  AND day_of_month IS NULL)
    OR
    (is_last_day = false AND day_of_month IS NOT NULL
                         AND day_of_month >= 1
                         AND day_of_month <= 31)
  )
);

ALTER TABLE fixed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_items_select" ON fixed_items FOR SELECT TO anon USING (true);
CREATE POLICY "fixed_items_insert" ON fixed_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "fixed_items_update" ON fixed_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "fixed_items_delete" ON fixed_items FOR DELETE TO anon USING (true);
