import { createClient } from "@supabase/supabase-js";

// const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'your-supabase-url';
// const supabaseKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'your-supabase-anon-key';
const supabaseUrl = "https://qmcztjtbqgzusvupqrcb.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY3p0anRicWd6dXN2dXBxcmNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2OTM5MywiZXhwIjoyMDg1MjQ1MzkzfQ.rNda4MmizFCkxJD2yGpd_Xg-LQ_haMbQgPwIxSQGs7w";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or ANON KEY is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
