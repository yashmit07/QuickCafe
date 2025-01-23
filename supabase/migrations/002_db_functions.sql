-- Function to check if required extensions are installed
CREATE OR REPLACE FUNCTION check_extensions(required_extensions TEXT[])
RETURNS TABLE (
    extension_name TEXT,
    is_installed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ext.extname::TEXT,
        TRUE
    FROM 
        pg_extension ext
    WHERE 
        ext.extname = ANY(required_extensions);
END;
$$ LANGUAGE plpgsql;

-- Drop existing function first
DROP FUNCTION IF EXISTS search_nearby_cafes(double precision, double precision, integer, price_level);

-- Function to search nearby cafes with filtering
CREATE OR REPLACE FUNCTION search_nearby_cafes(
    search_lat DOUBLE PRECISION,
    search_lng DOUBLE PRECISION,
    radius_meters INTEGER,
    price_filter price_level DEFAULT NULL,
    page_size INTEGER DEFAULT 20,
    page_number INTEGER DEFAULT 1
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
    last_review_fetch TIMESTAMPTZ,
    vibe_scores JSON,
    amenity_scores JSON
) AS $$
DECLARE
    offset_val INTEGER;
BEGIN
    offset_val := (page_number - 1) * page_size;
    
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
        AND (price_filter IS NULL OR c.price_level = price_filter)
    ),
    vibe_agg AS (
        SELECT 
            cafe_id,
            json_object_agg(vibe_category, confidence_score) as vibe_scores
        FROM cafe_vibes
        GROUP BY cafe_id
    ),
    amenity_agg AS (
        SELECT 
            cafe_id,
            json_object_agg(amenity, confidence_score) as amenity_scores
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
        nc.last_review_fetch,
        COALESCE(v.vibe_scores, '{}'::json) as vibe_scores,
        COALESCE(a.amenity_scores, '{}'::json) as amenity_scores
    FROM nearby_cafes nc
    LEFT JOIN vibe_agg v ON v.cafe_id = nc.id
    LEFT JOIN amenity_agg a ON a.cafe_id = nc.id
    ORDER BY nc.distance
    LIMIT page_size
    OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;

-- Function to update cafe analysis results atomically
CREATE OR REPLACE FUNCTION update_cafe_analysis(
    p_cafe_id UUID,
    p_timestamp TIMESTAMPTZ,
    p_vibes JSON[],
    p_amenities JSON[]
) RETURNS void AS $$
BEGIN
    -- Delete existing analysis
    DELETE FROM cafe_vibes WHERE cafe_id = p_cafe_id;
    DELETE FROM cafe_amenities WHERE cafe_id = p_cafe_id;
    
    -- Insert new vibe analysis
    INSERT INTO cafe_vibes (cafe_id, vibe_category, confidence_score, last_analyzed)
    SELECT 
        p_cafe_id,
        (v->>'vibe_category')::vibe_category,
        (v->>'confidence_score')::decimal(4,3),
        p_timestamp
    FROM json_array_elements(p_vibes::json) v;
    
    -- Insert new amenity analysis
    INSERT INTO cafe_amenities (cafe_id, amenity, confidence_score, last_analyzed)
    SELECT 
        p_cafe_id,
        (a->>'amenity')::amenity_type,
        (a->>'confidence_score')::decimal(4,3),
        p_timestamp
    FROM json_array_elements(p_amenities::json) a;
END;
$$ LANGUAGE plpgsql;