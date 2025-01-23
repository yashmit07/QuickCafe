import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

export async function verifyDatabaseSetup() {
    try {
        console.log('Verifying database setup...');

        // Check if required tables exist
        const requiredTables = ['cafes', 'cafe_amenities', 'cafe_vibes', 'location_cache'];
        
        for (const table of requiredTables) {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error && !error.message.includes('does not exist')) {
                console.error(`Error checking ${table} table:`, error);
                throw new Error(`Database error while checking ${table} table`);
            }

            if (error?.message.includes('does not exist')) {
                console.error(`Table ${table} does not exist`);
                throw new Error(`Required table '${table}' does not exist. Please run the database migrations.`);
            }
        }

        // Check if required extensions exist
        const { data: extensions, error: extError } = await supabase
            .rpc('check_extensions', {
                required_extensions: ['uuid-ossp', 'postgis']
            });

        if (extError) {
            console.error('Error checking extensions:', extError);
            throw new Error('Required database extensions are not installed');
        }

        // Check if functions exist
        const { data: searchResult, error: searchError } = await supabase
            .rpc('search_nearby_cafes', {
                search_lat: 0,
                search_lng: 0,
                radius_meters: 1,
                price_filter: null
            });

        if (searchError && !searchError.message.includes('No cafes found')) {
            console.error('Error checking search function:', searchError);
            throw new Error('Required database function search_nearby_cafes is not properly set up');
        }

        console.log('Database setup verified successfully');
        return true;
    } catch (error) {
        console.error('Database verification failed:', error);
        throw error;
    }
}