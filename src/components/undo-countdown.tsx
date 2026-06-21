"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

interface Props {
  decidedAt: string;
  onUndo: () => void;
  loading?: boolean;
}

const WINDOW_MS = 30 * 60 * 1000;

export function UndoCountdown({ decidedAt, onUndo, loading = false }: Props) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - new Date(decidedAt).getTime();
      setRemaining(Math.max(0, WINDOW_MS - elapsed));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [decidedAt]);

  if (remaining <= 0) return null;

  const totalSec = Math.floor(remaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const label = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <button
      onClick={onUndo}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <RotateCcw size={14} />
      Undo ({label})
    </button>
  );
}
