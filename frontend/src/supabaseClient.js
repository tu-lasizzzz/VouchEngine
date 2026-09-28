import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://puyubxmwckcenpfkywnj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lOF3geGciP8YydewgpVSVQ_MQaOsavw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
