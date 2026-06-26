-- Add new profile customization options
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_position TEXT DEFAULT 'left';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_name BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS typing_bio BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio_texts TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hover_effect TEXT DEFAULT 'glow';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS entrance_animation TEXT DEFAULT 'fade';
