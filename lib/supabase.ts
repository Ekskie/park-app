import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'your-supabase-url';
// const supabaseKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'your-supabase-anon-key';
const supabaseUrl = "https://tyiiawylacwgxproemzc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aWlhd3lsYWN3Z3hwcm9lbXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3ODAxOTQsImV4cCI6MjA3ODM1NjE5NH0.7MbM7pazCbIip_fzUpLNgsqCHz9YrnRw0iCjgRqcVzU";

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or ANON KEY is missing!');
}

export const supabase = createClient(supabaseUrl, supabaseKey);