import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * يُستدعى من middleware.ts في جذر المشروع.
 * يحدّث جلسة المستخدم (refresh token) مع كل طلب، ويحمي مسارات لوحة التحكم من
 * الوصول غير المصرَّح به (تُعاد التوجيه لصفحة /login إن لم يوجد مستخدم مسجَّل).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // كل الصفحات محمية افتراضياً ما عدا صفحة تسجيل الدخول.
  // بهذا أي صفحة جديدة (سائقين/شركات/رحلات/تقارير...) تُحمى تلقائياً دون تعديل هذا الملف.
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
