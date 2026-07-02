import { createClient } from '@supabase/supabase-js';

// Estas variables irán en tu archivo .env.local y en Netlify
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mljzwaedaxtxzzogkmpz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sanp3YWVkYXh0eHp6b2drbXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NTkyMTAsImV4cCI6MjA5ODUzNTIxMH0.xDs_Ay12ASRDacgyTcMtk0tZR954Ty7wjTYl1yjpdx0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);