import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Guarantee Vitest unit tests execute against reliable local mock storage
// Real Supabase credentials in .env are reserved for live application runtime
if (!process.env.VITE_TEST_LIVE_SUPABASE) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://mock-school.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'dummy_anon_key_for_local_testing');
}
