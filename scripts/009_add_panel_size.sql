-- Add panel_size column for card width control
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS panel_size TEXT DEFAULT 'medium';
