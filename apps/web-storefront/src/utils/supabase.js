import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TARO_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.TARO_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

