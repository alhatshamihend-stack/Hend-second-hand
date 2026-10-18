import { createClient } from '@supabase/supabase-js';

const getEnvValue = (key) => {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }

  return process.env[key] || '';
};

const supabaseUrl = getEnvValue('TARO_APP_SUPABASE_URL');
const supabaseAnonKey = getEnvValue('TARO_APP_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export function getProductQuery(id) {
  if (!id) {
    return '';
  }

  return `${supabaseUrl}/rest/v1/products_zzer?select=*&id=eq.${encodeURIComponent(id)}`;
}

export async function getLatestProducts() {
  const { data, error } = await supabase
    .from('products_zzer')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data || [];
}
