const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

// Initialize Supabase client
let supabase = null;

const getSupabase = () => {
    if (!supabase && config.supabaseUrl && config.supabaseKey) {
        supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
    return supabase;
};

/**
 * Get customer by Facebook Page-Scoped ID (PSID)
 */
const getCustomerByPSID = async (psid) => {
    const client = getSupabase();
    if (!client) {
        console.log('⚠️ Supabase not configured, skipping customer lookup');
        return null;
    }

    try {
        const { data, error } = await client
            .from('customers')
            .select('*')
            .eq('psid', psid)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is expected for new customers
            console.error('Error fetching customer:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in getCustomerByPSID:', error);
        return null;
    }
};

/**
 * Create a new customer record
 */
const createCustomer = async (customerData) => {
    const client = getSupabase();
    if (!client) {
        console.log('⚠️ Supabase not configured, skipping customer creation');
        return null;
    }

    try {
        const { data, error } = await client
            .from('customers')
            .insert([{
                psid: customerData.psid,
                name: customerData.name || null,
                phone: customerData.phone || null,
                email: customerData.email || null,
                page_id: customerData.pageId || null,
                first_message: customerData.firstMessage || null,
                is_paused: customerData.is_paused || false,
                last_human_reply_at: customerData.last_human_reply_at || null,
                created_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating customer:', error);
            return null;
        }

        console.log('✅ Customer created:', data.id);
        return data;
    } catch (error) {
        console.error('Error in createCustomer:', error);
        return null;
    }
};

/**
 * Update customer information
 */
const updateCustomer = async (psid, updates) => {
    const client = getSupabase();
    if (!client) {
        console.log('⚠️ Supabase not configured, skipping customer update');
        return null;
    }

    try {
        const { data, error } = await client
            .from('customers')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('psid', psid)
            .select()
            .single();

        if (error) {
            console.error('Error updating customer:', error);
            return null;
        }

        console.log('✅ Customer updated:', data.id);
        return data;
    } catch (error) {
        console.error('Error in updateCustomer:', error);
        return null;
    }
};

/**
 * Log spam message
 */
const logSpam = async (spamData) => {
    const client = getSupabase();
    if (!client) {
        console.log('⚠️ Supabase not configured, skipping spam logging');
        return null;
    }

    try {
        const { data, error } = await client
            .from('spam_logs')
            .insert([{
                psid: spamData.psid,
                message: spamData.message,
                classification_reason: spamData.reason || null,
                confidence: spamData.confidence || null,
                created_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) {
            console.error('Error logging spam:', error);
            return null;
        }

        console.log('🚫 Spam logged:', data.id);
        return data;
    } catch (error) {
        console.error('Error in logSpam:', error);
        return null;
    }
};

/**
 * Get recent spam logs for a PSID
 */
const getRecentSpamLogs = async (psid, limit = 5) => {
    const client = getSupabase();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('spam_logs')
            .select('*')
            .eq('psid', psid)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching spam logs:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getRecentSpamLogs:', error);
        return [];
    }
};

/**
 * Log a customer query
 */
const logQuery = async (queryData) => {
    const client = getSupabase();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('queries')
            .insert([{
                psid: queryData.psid,
                query_text: queryData.messageText,
                category: queryData.category || 'General',
                is_spam: queryData.isSpam || false,
                created_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) {
            console.error('Error logging query:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in logQuery:', error);
        return null;
    }
};

/**
 * Pause AI for a customer (when human intervenes)
 */
const pauseCustomer = async (psid) => {
    const customer = await getCustomerByPSID(psid);

    if (!customer) {
        // Support messaged someone first - create record and pause
        console.log(`👤 Creating and pausing record for new customer ${psid} (Support initiated)`);
        return await createCustomer({
            psid,
            is_paused: true,
            last_human_reply_at: new Date().toISOString()
        });
    }

    return await updateCustomer(psid, {
        is_paused: true,
        last_human_reply_at: new Date().toISOString()
    });
};

/**
 * Resume AI for a customer
 */
const resumeCustomer = async (psid) => {
    return await updateCustomer(psid, { is_paused: false });
};

/**
 * Get brands by category
 */
const getBrandsByCategory = async (category) => {
    const client = getSupabase();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('brands')
            .select('name')
            .ilike('category', `%${category}%`);

        if (error) {
            console.error('Error fetching brands:', error);
            return [];
        }

        return data.map(b => b.name);
    } catch (error) {
        console.error('Error in getBrandsByCategory:', error);
        return [];
    }
};

module.exports = {
    getCustomerByPSID,
    createCustomer,
    updateCustomer,
    logSpam,
    getRecentSpamLogs,
    logQuery,
    pauseCustomer,
    resumeCustomer,
    getBrandsByCategory,
};
