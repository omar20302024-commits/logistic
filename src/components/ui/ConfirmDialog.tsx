"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "تأكيد الحذف",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            danger ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
          }`}
        >
          <AlertTriangle size={22} />
        </div>
        <p className="text-sm text-zinc-600">{description}</p>
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800"
          }`}
        >
          {loading ? "جارٍ التنفيذ..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
