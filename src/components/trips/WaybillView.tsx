// بوليصة شحن — وثيقة تُسلَّم مع الشحنة وقد تصل للعميل أو لأي جهة على الطريق.
// 🔒 لا تحتوي ولا تستقبل أي مبلغ إطلاقاً: لا سعر رحلة، ولا ترب، ولا ديزل،
// ولا ربح (قاعدتا #3 و#11). أنواع الـ props هنا لا تسمح بتمرير أي منها.

type WaybillLocation = {
  location_name: string;
  branch_code: string | null;
  location_type: "loading" | "unloading";
};

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
  vehicleNo,
  vehicleType,
  fromLocation,
  toLocation,
  requester,
  locations,
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
  vehicleNo: string | null;
  vehicleType: string | null;
  fromLocation: string;
  toLocation: string;
  requester: string | null;
  locations: WaybillLocation[];
  notes: string | null;
}) {
  const loading = locations.filter((l) => l.location_type === "loading");
  const unloading = locations.filter((l) => l.location_type === "unloading");

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
        <Info label="السيارة" value={vehicleNo ?? "—"} ltr />
        <Info label="نوع السيارة" value={vehicleType ?? "—"} />
      </div>

      <div className="border-b border-zinc-200 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3 text-lg font-bold text-zinc-900">
          <span>{fromLocation}</span>
          <span className="text-zinc-300">←</span>
          <span>{toLocation}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 py-5 sm:grid-cols-2">
        <LocationList title="مواقع التحميل" items={loading} />
        <LocationList title="مواقع التنزيل" items={unloading} />
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

function LocationList({ title, items }: { title: string; items: WaybillLocation[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-zinc-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">—</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600">
                {i + 1}
              </span>
              <span>
                {l.location_name}
                {l.branch_code && (
                  <span className="ms-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {l.branch_code}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
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
