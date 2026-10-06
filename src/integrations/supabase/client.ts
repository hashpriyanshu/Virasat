import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createMockSupabaseClient } from './mockClient';

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://aysqzemlnjddoclgwtjt.supabase.co";
const RAW_SUPABASE_KEY = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5c3F6ZW1sbmpkZG9jbGd3dGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzY5NDQsImV4cCI6MjA3MjcxMjk0NH0.LsRuWLNiqDGGCSWoVzvWPcO9yAu3QyNrZGh2ls5ZX_U";

// Determine whether to use local offline mock client:
// 1. If explicit env flag VITE_USE_LOCAL_STORAGE is 'true'
// 2. If the URL is the deleted Lovable placeholder ('aysqzemlnjddoclgwtjt')
// 3. If URL is missing, invalid, or contains 'placeholder'
export const isLocalMode = 
  import.meta.env.VITE_USE_LOCAL_STORAGE === 'true' ||
  !RAW_SUPABASE_URL ||
  RAW_SUPABASE_URL.includes("aysqzemlnjddoclgwtjt") ||
  RAW_SUPABASE_URL.includes("placeholder") ||
  RAW_SUPABASE_URL === "https://your-project.supabase.co";

// Export standard Supabase client (typed with Database)
export const supabase: any = isLocalMode
  ? createMockSupabaseClient()
  : createClient<Database>(RAW_SUPABASE_URL, RAW_SUPABASE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    });