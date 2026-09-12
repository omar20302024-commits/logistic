// بوليصة شحن — وثيقة تُسلَّم مع الشحنة وقد تصل للعميل أو لأي جهة على الطريق.
// 🔒 لا تحتوي ولا تستقبل أي مبلغ إطلاقاً: لا سعر رحلة، ولا ترب، ولا ديزل،
// ولا ربح (قاعدتا #3 و#11). أنواع الـ props هنا لا تسمح بتمرير أي منها.

export function WaybillView({
  orgName,
  orgPhone,
  orgAddress,
  waybillNo,
  issuedAt,
  tripNumber,
  tripDate,
  companyName,
  driverName,
  driverPhone,
  vehicleType,
  fromLocation,
  toLocation,
  requester,
  branchesCount,
  notes,
}: {
  orgName: string;
  orgPhone: string | null;
  orgAddress: string | null;
  waybillNo: string;
  issuedAt: string;
  tripNumber: string;
  tripDate: string;
  companyName: string;
  driverName: string;
  driverPhone: string | null;
  vehicleType: string | null;
  fromLocation: string;
  toLocation: string;
  requester: string | null;
  branchesCount: number;
  notes: string | null;
}) {

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="border-b-4 border-zinc-900 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{orgName}</h1>
            {orgPhone && (
              <p dir="ltr" className="text-sm text-zinc-500">
                {orgPhone}
              </p>
            )}
            {orgAddress && <p className="text-xs text-zinc-400">{orgAddress}</p>}
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-zinc-500">بوليصة شحن</div>
            <div className="text-lg font-bold text-zinc-900" dir="ltr">
              {waybillNo}
            </div>
            <div className="text-xs text-zinc-400" dir="ltr">
              {issuedAt.slice(0, 10)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-zinc-200 px-6 py-5 sm:grid-cols-4">
        <Info label="رقم الرحلة" value={tripNumber} ltr />
        <Info label="تاريخ الرحلة" value={tripDate} ltr />
        <Info label="العميل" value={companyName} />
        <Info label="صاحب الطلب" value={requester ?? "—"} />
        <Info label="السائق" value={driverName} />
        <Info label="جوال السائق" value={driverPhone ?? "—"} ltr />
        <Info label="نوع السيارة" value={vehicleType ?? "—"} />
      </div>

      <div className="border-b border-zinc-200 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3 text-lg font-bold text-zinc-900">
          <span>{fromLocation}</span>
          <span className="text-zinc-300">←</span>
          <span>{toLocation}</span>
        </div>
      </div>

      <div className="border-b border-zinc-200 px-6 py-4">
        <span className="text-xs text-zinc-400">عدد الفروع في الرحلة: </span>
        <span className="text-base font-bold text-zinc-900" dir="ltr">
          {branchesCount}
        </span>
      </div>

      {notes && (
        <div className="border-t border-zinc-100 px-6 py-4 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">ملاحظات: </span>
          {notes}
        </div>
      )}

      <div className="border-t border-zinc-200 px-6 py-6">
        <div className="grid grid-cols-3 gap-6 text-center text-xs text-zinc-500">
          <Signature label="توقيع المُرسِل" />
          <Signature label="توقيع السائق" name={driverName} />
          <Signature label="توقيع المستلِم" />
        </div>
      </div>

      <p className="border-t border-zinc-100 bg-zinc-50 px-6 py-3 text-center text-[11px] text-zinc-400">
        هذه البوليصة وثيقة تسليم فقط ولا تتضمن أي بيانات مالية
      </p>
    </div>
  );
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

function Signature({ label, name }: { label: string; name?: string }) {
  return (
    <div>
      <div className="mb-10">{label}</div>
      <div className="border-t border-zinc-300 pt-1">{name ?? " "}</div>
    </div>
  );
}
