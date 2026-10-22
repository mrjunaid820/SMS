import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-school.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const isLiveSupabaseConfigured = () => {
  return (
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    !import.meta.env.VITE_SUPABASE_URL.includes('placeholder') &&
    !import.meta.env.VITE_SUPABASE_URL.includes('mock') &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
    !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('dummy') &&
    !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('placeholder')
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
