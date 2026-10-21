import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

/**
 * نسخة احتياطية كاملة: كل جدول في ورقة Excel مستقلة.
 *
 * 🔑 لا مفتاح سرّي هنا إطلاقاً. يعمل بجلسة المستخدم نفسها، فـRLS هي التي
 *    تقرّر ما يُقرأ — ومن ليس مسؤولاً لا يخرج بشيء. لا service_role في
 *    الكود ولا في البيئة.
 *
 * ⚠️ هذه نسخة **للقراءة البشرية والأرشفة**، ليست بديلاً عن pg_dump: لا تحمل
 *    الدوال ولا السياسات ولا الفهارس ولا القيود، فلا يُعاد بناء قاعدة منها
 *    بضغطة. للاستعادة الكاملة انظر PROJECT_CONTEXT (§41).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// الترتيب مقصود: الجداول المرجعية أولاً ثم ما يعتمد عليها — فالقارئ يتدرّج
const TABLES = [
  "settings",
  "profiles",
  "companies",
  "company_branches",
  "vendors",
  "drivers",
  "vehicle_types",
  "vehicles",
  "vehicle_assignments",
  "trips",
  "trip_locations",
  "waybills",
  "driver_route_rates",
  "vendor_route_rates",
  "route_rates",
  "driver_advances",
  "driver_deductions",
  "driver_custody_entries",
  "driver_diesel_entries",
  "driver_monthly_diesel",
  "driver_leaves",
  "driver_settlements",
  "vendor_advances",
  "vendor_settlements",
  "salaries",
  "expenses",
  "housing_units",
  "rental_contracts",
  "sheet_sync_dismissed",
] as const;

/** PostgREST يسقّف الصفحة الواحدة، فنقرأ على دفعات حتى ينفد الجدول */
const PAGE = 1000;

function cellValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const index = workbook.addWorksheet("الفهرس");
  index.columns = [
    { header: "الجدول", key: "table", width: 28 },
    { header: "عدد الصفوف", key: "count", width: 14 },
    { header: "ملاحظة", key: "note", width: 40 },
  ];
  index.getRow(1).font = { bold: true };

  for (const table of TABLES) {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    let note = "";

    // حلقة مفتوحة النهاية مقصودة: نتوقف حين تعود دفعة أقصر من الحدّ
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(offset, offset + PAGE - 1);

      if (error) {
        // جدول ناقص (ملف SQL لم يُشغَّل) أو محجوب بـRLS — يُذكر ولا يُسقط
        // النسخة كلها، فنصف نسخة خير من لا شيء وقت الحاجة.
        note = `تعذّرت القراءة: ${error.message}`;
        break;
      }

      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < PAGE) break;
      offset += PAGE;
    }

    index.addRow({ table, count: rows.length, note });

    const sheet = workbook.addWorksheet(table.slice(0, 31));

    if (rows.length === 0) {
      sheet.addRow([note || "لا توجد بيانات"]);
      continue;
    }

    // ترويسة الأعمدة من اتحاد مفاتيح كل الصفوف: صفٌّ ناقص حقلاً لا يُسقط عموداً
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    sheet.columns = keys.map((k) => ({ header: k, key: k, width: 20 }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const r of rows) {
      const out: Record<string, string | number | boolean | null> = {};
      for (const k of keys) out[k] = cellValue(r[k]);
      sheet.addRow(out);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
