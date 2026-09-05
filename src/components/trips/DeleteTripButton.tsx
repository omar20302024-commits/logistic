"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteTrip } from "@/app/(dashboard)/trips/actions";

export function DeleteTripButton({ tripId, tripNumber }: { tripId: string; tripNumber: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteTrip(tripId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("تم حذف الرحلة");
    router.push("/trips");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <Trash2 size={15} />
        حذف الرحلة
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="حذف الرحلة"
        description={`هل أنت متأكد من حذف الرحلة "${tripNumber}"؟ سيتم حذف كل مواقعها المرتبطة أيضاً. لا يمكن التراجع.`}
      />
    </>
  );
}
