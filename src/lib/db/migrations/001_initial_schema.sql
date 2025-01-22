-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
-- Create ENUMs
CREATE TYPE price_level AS ENUM ('$', '$$', '$$$');
CREATE TYPE vibe_category AS ENUM (
    'cozy', 'modern', 'quiet', 'lively', 
    'artistic', 'traditional', 'industrial'
);
CREATE TYPE amenity_type AS ENUM (
    'wifi', 'outdoor_seating', 'power_outlets',
    'pet_friendly', 'parking', 'workspace_friendly',
    'food_menu'
);
-- Core cafe data
CREATE TABLE cafes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_place_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT NOT NULL,
    price_level price_level,
    reviews JSONB[],
    last_review_fetch TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Cafe amenities from review analysis
CREATE TABLE cafe_amenities (
    cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE,
    amenity amenity_type NOT NULL,
    confidence_score DECIMAL(4,3),
    last_analyzed TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cafe_id, amenity)
);
-- Cafe vibes from review analysis
CREATE TABLE cafe_vibes (
    cafe_id UUID REFERENCES cafes(id) ON DELETE CASCADE,
    vibe_category vibe_category NOT NULL,
    confidence_score DECIMAL(4,3),
    last_analyzed TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (cafe_id, vibe_category)
);
-- Location search cache
CREATE TABLE location_cache (
    search_location TEXT PRIMARY KEY,
    cafe_ids UUID[] NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
-- Create indexes
CREATE INDEX cafes_location_idx ON cafes USING GIST(location);
CREATE INDEX cafes_price_idx ON cafes(price_level);
CREATE INDEX cafe_vibes_analysis_date_idx ON cafe_vibes(last_analyzed);
CREATE INDEX cafe_amenities_analysis_date_idx ON cafe_amenities(last_analyzed);