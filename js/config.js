/**
 * ArborMark - Cloud Configuration
 * 
 * To switch from LocalStorage to a live Supabase database:
 * 1. Create a free project at https://supabase.com
 * 2. Paste your API credentials below (URL and public anon key)
 * 3. Run the SQL schema provided in your walkthrough or walkthrough.md
 * 
 * If URL is left empty, the application will automatically run in local-offline mode (LocalStorage).
 */

export const CLOUD_CONFIG = {
    // Replace with your actual Supabase Project URL, e.g., 'https://xyz.supabase.co'
    SUPABASE_URL: '',
    
    // Replace with your actual Supabase Public Anon Key (found in Project Settings -> API)
    SUPABASE_ANON_KEY: ''
};
