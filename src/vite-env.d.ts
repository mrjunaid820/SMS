/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_REGISTRATION_NO: string;
  readonly VITE_APP_CURRENCY: string;
  readonly VITE_APP_CURRENCY_SYMBOL: string;
  readonly VITE_APP_TIMEZONE: string;
  readonly VITE_ENABLE_OFFLINE_FALLBACK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
