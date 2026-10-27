import { describe, it, expect } from 'vitest';
import { isLiveSupabaseConfigured } from '../src/config/supabase';

describe('Server & Database Connection Health & Configuration Isolation', () => {
  it('correctly classifies mock or placeholder configurations', () => {
    // In test environment, setup.ts sets VITE_SUPABASE_URL to https://mock-school.supabase.co
    // and VITE_SUPABASE_ANON_KEY to dummy_anon_key_for_local_testing
    expect(isLiveSupabaseConfigured()).toBe(false);
  });

  it('validates live configuration requirements without exposing secrets', () => {
    const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    expect(rawUrl).toBeDefined();
    expect(rawKey).toBeDefined();
    // Ensure service role key or database passwords are NOT present in client environment
    expect((import.meta.env as any).SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect((import.meta.env as any).DATABASE_URL).toBeUndefined();
    expect((import.meta.env as any).POSTGRES_PASSWORD).toBeUndefined();
  });
});
