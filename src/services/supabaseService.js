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

module.exports = {
    getCustomerByPSID,
    createCustomer,
    updateCustomer,
    logSpam,
};
