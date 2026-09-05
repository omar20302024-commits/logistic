import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/** عميل Supabase للاستخدام داخل Server Components / Route Handlers / Server Actions */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // يحدث عند استدعائها من Server Component بدلاً من Server Action/Route Handler
            // — يمكن تجاهله إذا كان middleware.ts يتولى تحديث الجلسة أصلاً.
          }
        },
      },
    }
  );
}
