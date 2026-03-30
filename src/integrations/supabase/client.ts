import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Tenant ID — each salon deployment sets this in .env
export const TENANT_ID: string = import.meta.env.VITE_TENANT_ID || '';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      // Sent with every request so RLS policies can scope by tenant
      ...(TENANT_ID ? { 'x-tenant-id': TENANT_ID } : {}),
    },
  },
});