import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경 변수가 없거나 아직 placeholder면 Supabase 없이(=localStorage 폴백) 동작한다.
export const isSupabaseEnabled =
  !!url && !!anonKey && !url.startsWith("REPLACE_WITH");

export const supabase = isSupabaseEnabled ? createClient(url, anonKey) : null;
