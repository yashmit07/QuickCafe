-- Drop ALL possible variations of both functions
DROP FUNCTION IF EXISTS search_nearby_cafes(double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS search_nearby_cafes(double precision, double precision, integer, price_level, integer, integer);
DROP FUNCTION IF EXISTS search_nearby_cafes(double precision, double precision, integer, price_level, integer);
DROP FUNCTION IF EXISTS search_nearby_cafes(double precision, double precision, integer, integer, integer);

-- Drop all versions of the new function too
DROP FUNCTION IF EXISTS find_cafes_v2(double precision, double precision, integer, price_level, integer);
DROP FUNCTION IF EXISTS find_cafes_v2(double precision, double precision, integer, text, integer);

-- Create a completely new function with a different name
CREATE OR REPLACE FUNCTION find_cafes_v2(
    search_lat DOUBLE PRECISION,
    search_lng DOUBLE PRECISION,
    radius_meters INTEGER,
    price_filter TEXT DEFAULT NULL,
    page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    google_place_id TEXT,
    name TEXT,
    location TEXT,
    address TEXT,
    distance DOUBLE PRECISION,
    price_level price_level,
    reviews JSONB[],
    operating_hours JSONB,
    photos JSONB[],
    last_review_fetch TIMESTAMPTZ,
    vibe_scores JSON,
    amenity_scores JSON
) AS $$
BEGIN    
    RETURN QUERY
    WITH nearby_cafes AS (
        SELECT 
            c.id,
            c.google_place_id,
            c.name,
            c.location,
            c.address,
            c.price_level,
            c.reviews,
            c.operating_hours,
            c.photos,
            c.last_review_fetch,
            ST_Distance(
                c.location::geography,
                ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
            ) as distance
        FROM cafes c
        WHERE ST_DWithin(
            c.location::geography,
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
            radius_meters
        )
        AND (price_filter IS NULL OR c.price_level::text = price_filter)
    ),
    vibe_scores_json AS (
        SELECT 
            cafe_id,
            json_object_agg(
                vibe_category::text, 
                confidence_score
            ) as vibe_scores
        FROM cafe_vibes
        GROUP BY cafe_id
    ),
    amenity_scores_json AS (
        SELECT 
            cafe_id,
            json_object_agg(
                amenity::text, 
                confidence_score
            ) as amenity_scores
        FROM cafe_amenities
        GROUP BY cafe_id
    )
    SELECT 
        nc.id,
        nc.google_place_id,
        nc.name,
        ST_AsText(nc.location) as location,
        nc.address,
        nc.distance,
        nc.price_level,
        nc.reviews,
        nc.operating_hours,
        nc.photos,
        nc.last_review_fetch,
        COALESCE(v.vibe_scores, '{}'::json) as vibe_scores,
        COALESCE(a.amenity_scores, '{}'::json) as amenity_scores
    FROM nearby_cafes nc
    LEFT JOIN vibe_scores_json v ON v.cafe_id = nc.id
    LEFT JOIN amenity_scores_json a ON a.cafe_id = nc.id
    ORDER BY nc.distance
    LIMIT page_size;
END;
$$ LANGUAGE plpgsql; 