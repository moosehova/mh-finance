const CONFIG = {
    supabaseUrl: "https://inaicxrxkvarbgcordko.supabase.co",
    supabaseKey: "sb_publishable_7os6DBOgL5T2H4e5K-seUQ_56VosXbG",
    storageBucket: "product-images",
    whatsapp: "260975931621",
    brand: "MH Finance",
    currency: "ZMW",
    whatsappMessage: "Hello MH Finance, I would like to apply for ",
    firebase: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "mh-finance-admin.firebaseapp.com",
        databaseURL: "https://mh-finance-admin-default-rtdb.firebaseio.com",
        projectId: "mh-finance-admin",
        storageBucket: "mh-finance-admin.firebasestorage.app",
        messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
        appId: "YOUR_FIREBASE_APP_ID"
    }
};

// Ensures we ONLY pull MH Finance data from the shared Studio table
const CLIENT_ID = 'mh-finance';
const LEADS_STORAGE_KEY = 'mh_finance_leads';
const FIREBASE_LEADS_PATH = `clients/${CLIENT_ID}/leads`;

function hasConfiguredValue(value) {
    return typeof value === 'string' && value.trim() !== '' && !value.startsWith('YOUR_');
}

function hasFirebaseKeys() {
    const firebaseConfig = CONFIG.firebase || {};
    return hasConfiguredValue(firebaseConfig.apiKey)
        && hasConfiguredValue(firebaseConfig.projectId)
        && hasConfiguredValue(firebaseConfig.databaseURL)
        && hasConfiguredValue(firebaseConfig.appId)
        && hasConfiguredValue(firebaseConfig.messagingSenderId);
}

function getFirebaseDatabase() {
    if (typeof firebase === 'undefined' || !hasFirebaseKeys()) {
        return null;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(CONFIG.firebase);
    }

    return firebase.database();
}

function getLocalLeads() {
    try {
        const stored = localStorage.getItem(LEADS_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function setLocalLeads(leads) {
    try {
        localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    } catch (error) {
        console.error('Failed to persist local leads:', error);
    }
}

const hasSupabaseConfig = hasConfiguredValue(CONFIG.supabaseUrl) && hasConfiguredValue(CONFIG.supabaseKey);
const { createClient } = typeof supabase !== 'undefined' ? supabase : { createClient: null };
const _supabase = (typeof createClient === 'function' && hasSupabaseConfig)
    ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)
    : null;
