import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.TARO_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.TARO_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase.js] Warning: TARO_APP_SUPABASE_URL eller TARO_APP_SUPABASE_ANON_KEY är undefined. Supabase-klienten kan inte initieras korrekt.',
    {
      TARO_APP_SUPABASE_URL: !!supabaseUrl,
      TARO_APP_SUPABASE_ANON_KEY: !!supabaseAnonKey,
    },
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
