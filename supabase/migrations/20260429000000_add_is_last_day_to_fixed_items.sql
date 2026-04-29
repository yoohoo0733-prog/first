-- Add is_last_day column (default false keeps existing rows valid)
ALTER TABLE fixed_items ADD COLUMN is_last_day boolean NOT NULL DEFAULT false;

-- Allow day_of_month to be NULL (required for is_last_day = true rows)
ALTER TABLE fixed_items ALTER COLUMN day_of_month DROP NOT NULL;

-- Replace old check constraint with one that handles both cases
ALTER TABLE fixed_items DROP CONSTRAINT fixed_items_day_of_month_check;

ALTER TABLE fixed_items ADD CONSTRAINT fixed_items_day_of_month_check CHECK (
  (is_last_day = true AND day_of_month IS NULL)
  OR
  (is_last_day = false AND day_of_month IS NOT NULL AND day_of_month BETWEEN 1 AND 31)
);
