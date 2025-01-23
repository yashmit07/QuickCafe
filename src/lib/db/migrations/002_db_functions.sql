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

-- Drop existing functions first
DROP FUNCTION IF EXISTS search_nearby_cafes(double precision, double precision, integer, price_level, integer, integer);
DROP FUNCTION IF EXISTS update_cafe_analysis(UUID, TIMESTAMPTZ, JSON[], JSON[]);

-- Drop existing tables
DROP TABLE IF EXISTS cafe_vibes;
DROP TABLE IF EXISTS cafe_amenities;

-- Create new tables with array columns
CREATE TABLE cafe_vibes (
    cafe_id UUID PRIMARY KEY REFERENCES cafes(id),
    vibe_categories vibe_category[] NOT NULL DEFAULT '{}',
    confidence_scores decimal(4,3)[] NOT NULL DEFAULT '{}',
    last_analyzed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cafe_amenities (
    cafe_id UUID PRIMARY KEY REFERENCES cafes(id),
    amenities amenity_type[] NOT NULL DEFAULT '{}',
    confidence_scores decimal(4,3)[] NOT NULL DEFAULT '{}',
    last_analyzed TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    price_length INTEGER;
    target_length INTEGER;
BEGIN
    offset_val := (page_number - 1) * page_size;
    
    -- Calculate target price length if price filter is provided
    IF price_filter IS NOT NULL THEN
        target_length := length(price_filter::text);
    END IF;
    
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
        AND (
            price_filter IS NULL 
            OR (
                c.price_level IS NOT NULL 
                AND abs(length(c.price_level::text) - target_length) <= 1
            )
        )
    ),
    vibe_scores_json AS (
        SELECT 
            cafe_id,
            json_object_agg(
                vibe_categories[i], 
                confidence_scores[i]
            ) as vibe_scores
        FROM cafe_vibes, 
             generate_subscripts(vibe_categories, 1) as i
        GROUP BY cafe_id
    ),
    amenity_scores_json AS (
        SELECT 
            cafe_id,
            json_object_agg(
                amenities[i], 
                confidence_scores[i]
            ) as amenity_scores
        FROM cafe_amenities,
             generate_subscripts(amenities, 1) as i
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
    LEFT JOIN vibe_scores_json v ON v.cafe_id = nc.id
    LEFT JOIN amenity_scores_json a ON a.cafe_id = nc.id
    ORDER BY nc.distance
    LIMIT page_size
    OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;

-- Function to update cafe analysis results atomically
CREATE OR REPLACE FUNCTION update_cafe_analysis(
    p_cafe_id UUID,
    p_timestamp TIMESTAMPTZ,
    p_vibes JSON,
    p_amenities JSON
) RETURNS void AS $$
DECLARE
    vibe_cats vibe_category[];
    vibe_scores decimal(4,3)[];
    amen_types amenity_type[];
    amen_scores decimal(4,3)[];
BEGIN
    -- Extract arrays from JSON for vibes
    WITH vibe_arrays AS (
        SELECT 
            array_agg(key::vibe_category) as categories,
            array_agg((value::text)::decimal(4,3)) as scores
        FROM json_each(p_vibes)
        WHERE (value::text)::decimal(4,3) > 0.4  -- Only include high-confidence vibes
    )
    SELECT categories, scores 
    INTO vibe_cats, vibe_scores 
    FROM vibe_arrays;

    -- Extract arrays from JSON for amenities
    WITH amenity_arrays AS (
        SELECT 
            array_agg(key::amenity_type) as types,
            array_agg((value::text)::decimal(4,3)) as scores
        FROM json_each(p_amenities)
        WHERE (value::text)::decimal(4,3) > 0.5  -- Only include high-confidence amenities
    )
    SELECT types, scores 
    INTO amen_types, amen_scores 
    FROM amenity_arrays;

    -- Update or insert vibe scores
    INSERT INTO cafe_vibes (
        cafe_id, 
        vibe_categories, 
        confidence_scores, 
        last_analyzed
    ) 
    VALUES (
        p_cafe_id, 
        COALESCE(vibe_cats, '{}'::vibe_category[]), 
        COALESCE(vibe_scores, '{}'::decimal(4,3)[]), 
        p_timestamp
    )
    ON CONFLICT (cafe_id) DO UPDATE 
    SET 
        vibe_categories = EXCLUDED.vibe_categories,
        confidence_scores = EXCLUDED.confidence_scores,
        last_analyzed = EXCLUDED.last_analyzed;

    -- Update or insert amenity scores
    INSERT INTO cafe_amenities (
        cafe_id, 
        amenities, 
        confidence_scores, 
        last_analyzed
    ) 
    VALUES (
        p_cafe_id, 
        COALESCE(amen_types, '{}'::amenity_type[]), 
        COALESCE(amen_scores, '{}'::decimal(4,3)[]), 
        p_timestamp
    )
    ON CONFLICT (cafe_id) DO UPDATE 
    SET 
        amenities = EXCLUDED.amenities,
        confidence_scores = EXCLUDED.confidence_scores,
        last_analyzed = EXCLUDED.last_analyzed;
END;
$$ LANGUAGE plpgsql;