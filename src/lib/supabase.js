import { createClient } from '@supabase/supabase-js';

// Estas variables irán en tu archivo .env.local y en Netlify
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'AQUI_TU_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'AQUI_TU_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);