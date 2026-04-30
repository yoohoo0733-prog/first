-- Add category column to distinguish salary, card, and regular fixed items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fixed_items' AND column_name = 'category'
  ) THEN
    ALTER TABLE fixed_items
      ADD COLUMN category text NOT NULL DEFAULT 'regular';
    ALTER TABLE fixed_items
      ADD CONSTRAINT fixed_items_category_check
      CHECK (category IN ('salary', 'card', 'regular'));
  END IF;
END $$;
