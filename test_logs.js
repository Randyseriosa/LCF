import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLogs() {
    const { data, error } = await supabase
        .from('item_transfer_logs')
        .select('*')
        .limit(5);
    console.log("Logs:", JSON.stringify(data, null, 2));
}

checkLogs();
