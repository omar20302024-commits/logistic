import { redirect } from "next/navigation";

// الصفحة الرئيسية مؤقتاً تحوّل مباشرة للوحة التحكم (أو لصفحة الدخول عبر middleware
// إن لم يكن المستخدم مسجلاً دخوله). صفحة الهبوط التسويقية الكاملة تُبنى في مرحلة لاحقة.
export default function Home() {
  redirect("/dashboard");
}
