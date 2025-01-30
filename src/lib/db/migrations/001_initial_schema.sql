-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create ENUMs if they don't exist
DO $$ BEGIN
    CREATE TYPE price_level AS ENUM ('$', '$$', '$$$');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vibe_category AS ENUM (
        'cozy', 'modern', 'quiet', 'lively', 
        'artistic', 'traditional', 'industrial'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE amenity_type AS ENUM (
        'wifi', 'outdoor_seating', 'power_outlets',
        'pet_friendly', 'parking', 'workspace_friendly',
        'food_menu'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS cafes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_place_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT NOT NULL,
    price_level price_level,
    reviews JSONB,
    operating_hours JSONB,
    photos JSONB,
    last_review_fetch TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafe_amenities (
    cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE,
    amenity amenity_type NOT NULL,
    confidence_score NUMERIC,
    last_analyzed TIMESTAMPTZ,
    PRIMARY KEY (cafe_id, amenity)
);

CREATE TABLE IF NOT EXISTS cafe_vibes (
    cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE,
    vibe_category vibe_category NOT NULL,
    confidence_score NUMERIC,
    last_analyzed TIMESTAMPTZ,
    PRIMARY KEY (cafe_id, vibe_category)
);

CREATE TABLE IF NOT EXISTS location_cache (
    search_location TEXT PRIMARY KEY,
    cafe_ids UUID[] NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if they don't exist
DO $$ BEGIN
    CREATE INDEX cafes_location_idx ON cafes USING GIST(location);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE INDEX cafes_price_idx ON cafes(price_level);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE INDEX cafe_vibes_analysis_date_idx ON cafe_vibes(last_analyzed);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE INDEX cafe_amenities_analysis_date_idx ON cafe_amenities(last_analyzed);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add transaction management functions
CREATE OR REPLACE FUNCTION begin_transaction() RETURNS void AS $$
BEGIN
    -- Start a new transaction
    BEGIN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commit_transaction() RETURNS void AS $$
BEGIN
    -- Commit the current transaction
    COMMIT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_transaction() RETURNS void AS $$
BEGIN
    -- Rollback the current transaction
    ROLLBACK;
END;
$$ LANGUAGE plpgsql;