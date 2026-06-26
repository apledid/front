-- Add widget_display_mode column for grid/stack/carousel layout
-- Also adds layout_mode if missing
-- Safe to run multiple times

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS widget_display_mode TEXT DEFAULT 'grid';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'standard';
