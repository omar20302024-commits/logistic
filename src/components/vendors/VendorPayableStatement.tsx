import { formatCurrency, formatNumber } from "@/lib/format";
import type { VendorPayableTripRow } from "@/lib/validation/vendor";

// ============================================================================
// الكشف الذي يُسلَّم للمورّد
// ============================================================================
//
// 🔒 تحذير معماري: هذا المكوّن مخصص حصرياً للكشف الخارج للمورّد.
//
// أنواع الـ props هنا **لا تحتوي سعر العميل ولا الربح**، ومصدرها
// fn_vendor_payable_trips التي لا تُرجعهما أصلاً. فحتى لو حاول أحد لاحقاً
// تمريرهما، لن تتوافق مع الأنواع المعرَّفة هنا ولن يجد مصدراً يأخذهما منه.
//
// 🚫 لا تُضف أي حقل عن قيمة الرحلة على العميل أو ربحها لهذا الملف مهما كان
//    السبب. كشف يخرج لطرف خارجي لا يُؤتمن على «نسينا نخفي عموداً».
//
// التصميم مأخوذ عن سند التصفية وكشوفات السائقين — نفس العائلة.

export function VendorPayableStatement({
  orgName,
  orgPhone,
  vendorName,
  vendorPhone,
  from,
  to,
  trips,
  advances,
  openingBalance = 0,
  openingReason = null,
  carriedBalance = 0,
  currencySymbol,
}: {
  orgName: string;
  orgPhone: string | null;
  vendorName: string;
  vendorPhone: string | null;
  from: string;
  to: string;
  trips: VendorPayableTripRow[];
  /** سلف مخصومة من حساب الرحلات — المورّد يراها لأنها تنقص مستحقه */
  advances: { date: string; amount: number; description: string | null }[];
  /** رصيد قديم غير مصفّى — مال له فيراه، وسببه معه */
  openingBalance?: number;
  /** متبقٍّ من تصفية سابقة دُفعت ناقصةً (0048) */
  carriedBalance?: number;
  openingReason?: string | null;
  currencySymbol: string;
}) {
  const totalAmount = trips.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalAdvances = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const opening = Number(openingBalance) || 0;
  const carried = Number(carriedBalance) || 0;
  const netDue = totalAmount + opening + carried - totalAdvances;

  return (
    <div className="print-statement overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="bg-zinc-900 px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">{orgName}</h1>
            {orgPhone && (
              <p dir="ltr" className="text-sm text-zinc-300">
                {orgPhone}
              </p>
            )}
          </div>
          <div className="text-left">
            <div className="text-xs text-zinc-400">كشف حساب المورّد</div>
            <div className="text-base font-bold">{vendorName}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 px-6 py-4 sm:grid-cols-4">
        <Info label="المورّد" value={vendorName} />
        <Info label="الهاتف" value={vendorPhone ?? "—"} ltr />
        <Info label="الفترة" value={`${from} ← ${to}`} ltr />
        <Info label="عدد الرحلات" value={formatNumber(trips.length)} ltr />
      </div>

      <div className="px-6 py-5">
        <Section title={`الرحلات غير المصروفة (${formatNumber(trips.length)})`}>
          {trips.length === 0 ? (
            <Empty>لا توجد رحلات غير مصروفة في هذه الفترة</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                    <Th>التاريخ</Th>
                    <Th>رقم الرحلة</Th>
                    <Th>السائق</Th>
                    <Th>خط السير</Th>
                    <Th>المواقع</Th>
                    <Th>المستحق</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {trips.map((t, i) => (
                    <tr key={i}>
                      <Td ltr>{t.trip_date}</Td>
                      <Td ltr>{t.trip_number}</Td>
                      <Td>{t.driver_name}</Td>
                      <Td>
                        {t.from_location} ← {t.to_location}
                      </Td>
                      <Td>{formatNumber(t.branches_count)}</Td>
                      <Td ltr strong>
                        {formatCurrency(t.amount, currencySymbol)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {advances.length > 0 && (
          <Section title="سلف مخصومة">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>المبلغ</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {advances.map((a, i) => (
                  <tr key={i}>
                    <Td ltr>{a.date}</Td>
                    <Td>{a.description ?? "—"}</Td>
                    <Td ltr>{formatCurrency(a.amount, currencySymbol)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <div className="print-keep mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <SummaryRow
            label="إجمالي الرحلات"
            value={totalAmount}
            currencySymbol={currencySymbol}
          />
          {opening > 0 && (
            <SummaryRow
              label={`رصيد سابق${openingReason ? ` — ${openingReason}` : ""}`}
              value={opening}
              currencySymbol={currencySymbol}
            />
          )}
          {carried > 0 && (
            <SummaryRow
              label="متبقٍّ من تصفية سابقة"
              value={carried}
              currencySymbol={currencySymbol}
            />
          )}
          {totalAdvances > 0 && (
            <SummaryRow
              label="السلف"
              value={totalAdvances}
              currencySymbol={currencySymbol}
              sign="minus"
            />
          )}

          <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-3">
            <span className="text-sm font-bold text-zinc-900">الصافي المستحق</span>
            <span className="text-lg font-bold text-zinc-900" dir="ltr">
              {formatCurrency(netDue, currencySymbol)}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-zinc-400">
          هذا الكشف يوضح مستحقات المورّد عن رحلاته في الفترة المذكورة.
        </p>

        <div className="print-keep mt-8 grid grid-cols-2 gap-8 text-center text-xs text-zinc-500">
          <div>
            <div className="mb-8">توقيع المورّد</div>
            <div className="border-t border-zinc-300 pt-1">{vendorName}</div>
          </div>
          <div>
            <div className="mb-8">توقيع المسؤول</div>
            <div className="border-t border-zinc-300 pt-1">{orgName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-bold text-zinc-900">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-xs text-zinc-400">{children}</p>;
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-sm font-medium text-zinc-900" dir={ltr ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}

// كل الأعمدة لليمين — القاعدة العامة في globals.css تُلغي محاذاة اليسار
function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 text-right font-medium">{children}</th>;
}

function Td({
  children,
  ltr,
  strong,
}: {
  children: React.ReactNode;
  ltr?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`py-2 text-right ${strong ? "font-semibold text-zinc-900" : "text-zinc-700"}`}
      dir={ltr ? "ltr" : undefined}
    >
      {children}
    </td>
  );
}

function SummaryRow({
  label,
  value,
  currencySymbol,
  sign,
}: {
  label: string;
  value: number;
  currencySymbol: string;
  sign?: "minus";
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-zinc-600">
        {sign === "minus" ? "− " : ""}
        {label}
      </span>
      <span className="text-sm text-zinc-900" dir="ltr">
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
}
