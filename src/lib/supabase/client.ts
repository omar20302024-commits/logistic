import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** عميل Supabase للاستخدام داخل Client Components (المتصفح) */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
