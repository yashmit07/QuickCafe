-- Function to search nearby cafes with filtering
CREATE OR REPLACE FUNCTION search_nearby_cafes(
    search_lat DOUBLE PRECISION,
    search_lng DOUBLE PRECISION,
    radius_meters INTEGER,
    price_filter price_level DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    distance DOUBLE PRECISION,
    price_level price_level,
    vibe_scores JSON,
    amenity_scores JSON
) AS $$
BEGIN
    RETURN QUERY
    WITH nearby_cafes AS (
        SELECT 
            c.id,
            c.name,
            c.price_level,
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
        nc.name,
        nc.distance,
        nc.price_level,
        COALESCE(v.vibe_scores, '{}'::json) as vibe_scores,
        COALESCE(a.amenity_scores, '{}'::json) as amenity_scores
    FROM nearby_cafes nc
    LEFT JOIN vibe_agg v ON nc.id = v.cafe_id
    LEFT JOIN amenity_agg a ON nc.id = a.cafe_id
    ORDER BY distance;
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