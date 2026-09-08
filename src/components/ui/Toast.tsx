"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  /** 「取り消す」のような、消える前に押せる操作 */
  action?: { label: string; onClick: () => void };
};

export function Toast({ message, onDismiss, durationMs = 3200, action }: Props) {
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
      <span className="flex items-center gap-3">
        <span className="flex-1">{message}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex-none font-medium text-paper underline underline-offset-2 hover:opacity-80"
          >
            {action.label}
          </button>
        )}
      </span>
    </div>
  );
}
