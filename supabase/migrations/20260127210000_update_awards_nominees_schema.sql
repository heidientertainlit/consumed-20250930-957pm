-- Update awards_nominees schema for consistency with rest of app
-- Add person_name column for nominee's name (actors, directors, etc.)
-- Add media_type column for future expansion
-- Rename 'name' to 'title' to match app conventions

-- Step 1: Add new columns
ALTER TABLE awards_nominees ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE awards_nominees ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'movie';

-- Step 2: Migrate data from current structure
-- For categories where name = person and title = film, move name to person_name and title to title
-- For Best Picture where name = film and title is null, name becomes title

-- First, copy person names from 'name' column for acting/directing categories
UPDATE awards_nominees 
SET person_name = name 
WHERE title IS NOT NULL;

-- For Best Picture (and similar), title stays in name, person_name stays null
-- Now rename 'name' to 'title' - but we need to handle this carefully
-- Since 'name' contains the film title for Best Picture and person name for other categories

-- Create new title column from existing data
UPDATE awards_nominees 
SET title = name 
WHERE title IS NULL;

-- For categories with people (actors, directors), title should be the film (currently in old 'title')
-- This is already correct - title column has the film name

-- Drop old 'name' column and keep title, person_name, media_type
ALTER TABLE awards_nominees DROP COLUMN IF EXISTS name;

-- Ensure all records have media_type set
UPDATE awards_nominees SET media_type = 'movie' WHERE media_type IS NULL;
