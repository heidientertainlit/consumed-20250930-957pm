
-- Add new columns to support the improved Entertainment DNA format
ALTER TABLE dna_profiles 
ADD COLUMN IF NOT EXISTS label TEXT,
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS flavor_notes TEXT[];

-- Update existing profiles to have empty arrays for flavor_notes if null
UPDATE dna_profiles 
SET flavor_notes = '{}' 
WHERE flavor_notes IS NULL;
