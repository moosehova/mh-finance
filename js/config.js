const CONFIG = {
    supabaseUrl: "YOUR_PROJECT_2_URL",
    supabaseKey: "YOUR_PROJECT_2_KEY",
    storageBucket: "product-images",
    whatsapp: "260975931621",
    brand: "MH Finance",
    currency: "ZMW",
    whatsappMessage: "Hello MH Finance, I would like to apply for "
};

// Ensures we ONLY pull MH Finance data from the shared Studio table
const CLIENT_ID = 'mh-finance';

const hasSupabaseConfig = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const { createClient } = typeof supabase !== 'undefined' ? supabase : { createClient: null };
const _supabase = (typeof createClient === 'function' && hasSupabaseConfig)
    ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)
    : null;
