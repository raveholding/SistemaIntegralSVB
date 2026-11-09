export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sin credenciales de Supabase la app corre con datos de demostración. */
export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;
