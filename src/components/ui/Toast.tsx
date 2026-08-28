"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function Toast({ message, onDismiss, durationMs = 3200 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 left-1/2 z-[200] max-w-[min(460px,calc(100%-2rem))] -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-[0.83rem] leading-relaxed text-paper shadow-lift transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
        message ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
