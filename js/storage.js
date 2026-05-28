/**
 * ArborMark - Database & LocalStorage Storage Engine (Hybrid Supabase Support)
 * Mobile-First Compatible (No top-level await)
 */

import { CLOUD_CONFIG } from './config.js';

let supabase = null;
let isCloudInitialized = false;

/**
 * Deferred Supabase Initializer
 * Eliminates top-level await, ensuring absolute compatibility on older mobile webviews and browsers.
 */
async function initSupabase() {
    if (isCloudInitialized) return supabase;
    isCloudInitialized = true;
    
    const isCloudEnabled = !!(CLOUD_CONFIG.SUPABASE_URL && CLOUD_CONFIG.SUPABASE_ANON_KEY);
    if (isCloudEnabled) {
        try {
            // ESM dynamic import inside standard async function (fully supported in mobile Safari/Chrome)
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            supabase = createClient(CLOUD_CONFIG.SUPABASE_URL, CLOUD_CONFIG.SUPABASE_ANON_KEY);
            console.log("ArborMark Database: Active cloud connection to Supabase initialized.");
        } catch (e) {
            console.error("ArborMark Database: Failed to load Supabase client SDK. Falling back to offline LocalStorage.", e);
        }
    } else {
        console.log("ArborMark Database: Config empty. Running in Offline LocalStorage Mode.");
    }
    return supabase;
}

const STORAGE_KEYS = {
    TREES: 'arbormark_trees',
    APPROVED_USERNAMES: 'arbormark_approved_usernames',
    REGISTERED_USERS: 'arbormark_registered_users',
    CUSTOM_FIELDS: 'arbormark_custom_fields',
    CURRENT_USER: 'arbormark_current_user'
};

const DEFAULT_APPROVED_USERNAMES = ['admin', 'volunteer1', 'arborist', 'green_finger', 'tree_hugger'];

const DEFAULT_CUSTOM_FIELDS = [
    {
        id: 'field_height',
        label: 'Estimated Height (meters)',
        type: 'number',
        options: ''
    },
    {
        id: 'field_canopy',
        label: 'Canopy Density',
        type: 'select',
        options: 'Sparse, Medium, Dense'
    },
    {
        id: 'field_health_notes',
        label: 'Health & Damage Notes',
        type: 'text',
        options: ''
    }
];

const DEFAULT_TREES = [
    {
        id: 'tree_1',
        commonName: 'English Oak',
        scientificName: 'Quercus robur',
        status: 'well_maintained',
        lat: 51.505,
        lng: -0.09,
        createdBy: 'arborist',
        createdAt: new Date().toISOString(),
        customFields: {
            field_height: '18',
            field_canopy: 'Dense',
            field_health_notes: 'Magnificent ancient oak, showing strong health.'
        }
    },
    {
        id: 'tree_2',
        commonName: 'Silver Birch',
        scientificName: 'Betula pendula',
        status: 'needs_care',
        lat: 51.507,
        lng: -0.08,
        createdBy: 'green_finger',
        createdAt: new Date().toISOString(),
        customFields: {
            field_height: '12',
            field_canopy: 'Medium',
            field_health_notes: 'Slight aphid infestation on lower branches. Needs monitoring.'
        }
    },
    {
        id: 'tree_3',
        commonName: 'Common Ash (Stump)',
        scientificName: 'Fraxinus excelsior',
        status: 'chopped',
        lat: 51.503,
        lng: -0.095,
        createdBy: 'volunteer1',
        createdAt: new Date().toISOString(),
        customFields: {
            field_height: '1',
            field_canopy: 'Sparse',
            field_health_notes: 'Recently chopped due to ash dieback safety hazard.'
        }
    }
];

// Initialize LocalStorage with sample data if empty
export function initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.APPROVED_USERNAMES)) {
        localStorage.setItem(STORAGE_KEYS.APPROVED_USERNAMES, JSON.stringify(DEFAULT_APPROVED_USERNAMES));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS)) {
        const initialUsers = {
            'admin': 'admin123',
            'volunteer1': 'volunteer123',
            'arborist': 'arborist123'
        };
        localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(initialUsers));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.CUSTOM_FIELDS)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_FIELDS, JSON.stringify(DEFAULT_CUSTOM_FIELDS));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.TREES)) {
        localStorage.setItem(STORAGE_KEYS.TREES, JSON.stringify(DEFAULT_TREES));
    }
}

// Local Helper Readers
function getParsedItem(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        return null;
    }
}

function setJsonItem(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
}

/* ----------------------------------------------------
   HYBRID API CONTROLLER (LS / SUPABASE SWITCH)
   ---------------------------------------------------- */

/* --- Tree Management --- */

export async function getTrees() {
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('trees')
                .select('*');
            
            if (error) throw error;
            
            return data.map(item => ({
                id: item.id,
                commonName: item.common_name,
                scientificName: item.scientific_name,
                status: item.status,
                lat: item.latitude,
                lng: item.longitude,
                createdBy: item.created_by,
                createdAt: item.created_at,
                customFields: typeof item.custom_fields === 'string' 
                    ? JSON.parse(item.custom_fields) 
                    : item.custom_fields || {}
            }));
        } catch (e) {
            console.error("Supabase tree read error, falling back to LocalStorage:", e);
        }
    }
    
    initStorage();
    return getParsedItem(STORAGE_KEYS.TREES) || [];
}

export async function saveTree(treeData) {
    const client = await initSupabase();
    if (client) {
        try {
            const dbTree = {
                common_name: treeData.commonName,
                scientific_name: treeData.scientificName,
                status: treeData.status,
                latitude: treeData.lat,
                longitude: treeData.lng,
                custom_fields: treeData.customFields || {}
            };
            
            if (treeData.id) {
                dbTree.id = treeData.id;
                const { data, error } = await client
                    .from('trees')
                    .upsert([dbTree]);
                
                if (error) throw error;
            } else {
                dbTree.created_by = treeData.createdBy || 'anonymous';
                const { data, error } = await client
                    .from('trees')
                    .insert([dbTree]);
                
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.error("Supabase tree save error, falling back to LocalStorage:", e);
        }
    }
    
    const trees = getParsedItem(STORAGE_KEYS.TREES) || [];
    if (treeData.id) {
        const idx = trees.findIndex(t => t.id === treeData.id);
        if (idx !== -1) {
            trees[idx] = { 
                ...trees[idx], 
                ...treeData,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        const newTree = {
            ...treeData,
            id: 'tree_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString()
        };
        trees.push(newTree);
    }
    setJsonItem(STORAGE_KEYS.TREES, trees);
    return trees;
}

export async function deleteTree(treeId) {
    const client = await initSupabase();
    if (client) {
        try {
            const { error } = await client
                .from('trees')
                .delete()
                .eq('id', treeId);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase tree delete error, falling back to LocalStorage:", e);
        }
    }
    
    let trees = getParsedItem(STORAGE_KEYS.TREES) || [];
    trees = trees.filter(t => t.id !== treeId);
    setJsonItem(STORAGE_KEYS.TREES, trees);
    return trees;
}

/* --- Permitted Usernames --- */

export async function getApprovedUsernames() {
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('approved_usernames')
                .select('username');
            
            if (error) throw error;
            return data.map(item => item.username);
        } catch (e) {
            console.error("Supabase approved usernames read error, falling back to LS:", e);
        }
    }
    
    initStorage();
    return getParsedItem(STORAGE_KEYS.APPROVED_USERNAMES) || [];
}

export async function addApprovedUsername(username) {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return false;
    
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('approved_usernames')
                .insert([{ username: normalized }]);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase approved username add error, falling back to LS:", e);
        }
    }
    
    const approved = getParsedItem(STORAGE_KEYS.APPROVED_USERNAMES) || [];
    if (approved.includes(normalized)) return false;
    approved.push(normalized);
    setJsonItem(STORAGE_KEYS.APPROVED_USERNAMES, approved);
    return true;
}

export async function removeApprovedUsername(username) {
    const normalized = username.trim().toLowerCase();
    
    const client = await initSupabase();
    if (client) {
        try {
            const { error } = await client
                .from('approved_usernames')
                .delete()
                .eq('username', normalized);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase approved username remove error, falling back to LS:", e);
        }
    }
    
    let approved = getParsedItem(STORAGE_KEYS.APPROVED_USERNAMES) || [];
    approved = approved.filter(u => u !== normalized);
    setJsonItem(STORAGE_KEYS.APPROVED_USERNAMES, approved);
    return true;
}

/* --- User Credentials & Session --- */

export async function getRegisteredUsers() {
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('registered_users')
                .select('*');
            
            if (error) throw error;
            
            const users = {};
            data.forEach(item => {
                users[item.username] = item.password;
            });
            return users;
        } catch (e) {
            console.error("Supabase registered users read error, falling back to LS:", e);
        }
    }
    
    initStorage();
    return getParsedItem(STORAGE_KEYS.REGISTERED_USERS) || {};
}

export async function registerUser(username, password) {
    const normalizedUser = username.trim().toLowerCase();
    const approved = await getApprovedUsernames();
    
    if (!approved.includes(normalizedUser)) {
        throw new Error('This username is not permitted to register. Please contact the administrator.');
    }
    
    const registered = await getRegisteredUsers();
    if (registered[normalizedUser]) {
        throw new Error('This username is already registered. Please login instead.');
    }
    
    if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
    }
    
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('registered_users')
                .insert([{ username: normalizedUser, password: password }]);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase user register error, falling back to LS:", e);
        }
    }
    
    registered[normalizedUser] = password;
    setJsonItem(STORAGE_KEYS.REGISTERED_USERS, registered);
    return true;
}

export async function authenticateUser(username, password) {
    const normalizedUser = username.trim().toLowerCase();
    const registered = await getRegisteredUsers();
    
    if (registered[normalizedUser] && registered[normalizedUser] === password) {
        const userSession = {
            username: normalizedUser,
            isAdmin: normalizedUser === 'admin',
            loginTime: Date.now()
        };
        setJsonItem(STORAGE_KEYS.CURRENT_USER, userSession);
        return userSession;
    }
    return null;
}

export function getCurrentUser() {
    return getParsedItem(STORAGE_KEYS.CURRENT_USER);
}

export function logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

/* --- Dynamic Custom Fields --- */

export async function getCustomFields() {
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('custom_fields')
                .select('*');
            
            if (error) throw error;
            
            return data.map(item => ({
                id: item.id,
                label: item.label,
                type: item.type,
                options: item.options || ''
            }));
        } catch (e) {
            console.error("Supabase custom fields read error, falling back to LS:", e);
        }
    }
    
    initStorage();
    return getParsedItem(STORAGE_KEYS.CUSTOM_FIELDS) || [];
}

export async function addCustomField(field) {
    const fields = await getCustomFields();
    if (fields.some(f => f.label.toLowerCase() === field.label.toLowerCase())) {
        throw new Error('A custom field with this label already exists.');
    }
    
    const fieldId = 'field_' + Date.now();
    const newField = {
        id: fieldId,
        label: field.label.trim(),
        type: field.type,
        options: field.options ? field.options.trim() : ''
    };
    
    const client = await initSupabase();
    if (client) {
        try {
            const { data, error } = await client
                .from('custom_fields')
                .insert([newField]);
            
            if (error) throw error;
            return newField;
        } catch (e) {
            console.error("Supabase custom field add error, falling back to LS:", e);
        }
    }
    
    fields.push(newField);
    setJsonItem(STORAGE_KEYS.CUSTOM_FIELDS, fields);
    return newField;
}

export async function removeCustomField(fieldId) {
    const client = await initSupabase();
    if (client) {
        try {
            const { error } = await client
                .from('custom_fields')
                .delete()
                .eq('id', fieldId);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.error("Supabase custom field delete error, falling back to LS:", e);
        }
    }
    
    let fields = await getCustomFields();
    fields = fields.filter(f => f.id !== fieldId);
    setJsonItem(STORAGE_KEYS.CUSTOM_FIELDS, fields);
    return true;
}
