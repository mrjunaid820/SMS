import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://wlfnihromgnivucxlsrh.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZm5paHJvbWduaXZ1Y3hsc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NjI0OTQsImV4cCI6MjEwODMzODQ5NH0.1z7u0M731nyXVpauS_eqHRT_CzJ1ecWf5ApavXdSe3Y';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isLiveSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return (
    Boolean(url) &&
    !url.includes('placeholder') &&
    !url.includes('mock') &&
    Boolean(key) &&
    !key.includes('dummy') &&
    !key.includes('placeholder')
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
