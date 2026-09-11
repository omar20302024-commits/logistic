/**
 * تذييل المراجعة — يظهر أسفل كل تقرير وكشف، على الشاشة وفي الطباعة.
 *
 * الاسم جاي من إعدادات المؤسسة (`settings.reviewed_by`) مش مكتوب في الكود،
 * عشان تغييره يبقى من شاشة الإعدادات. لو الإعداد فاضي، التذييل ما يظهرش.
 */
export function ReviewedByFooter({ name }: { name: string | null | undefined }) {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  return (
    <div className="border-t border-zinc-200 pt-3 text-center text-xs text-zinc-500 print:pt-4">
      تمت المراجعة بواسطة {trimmed}
    </div>
  );
}
