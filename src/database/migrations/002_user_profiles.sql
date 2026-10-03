-- Safe to run repeatedly against existing databases. Does not remove user data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_picture TEXT;
