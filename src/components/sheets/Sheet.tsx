"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** 下から出るシート。編集画面の破壊的操作はすべてこの中に置く（CLAUDE.md 8章） */
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[100] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(14,16,20,0.44)] transition-opacity duration-[240ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-label={title}
        aria-modal={open}
        className={`absolute bottom-0 left-1/2 flex max-h-[82vh] w-[min(520px,100%)] flex-col rounded-t-[18px] border-t border-rule bg-raised pb-[env(safe-area-inset-bottom)] shadow-lift transition-transform duration-[280ms] ease-[cubic-bezier(0.2,0,0,1)] ${
          open ? "translate-x-[-50%] translate-y-0" : "translate-x-[-50%] translate-y-full"
        }`}
      >
        <div className="mx-auto mb-0.5 mt-2.5 h-1 w-[34px] flex-none rounded-full bg-rule-strong" />
        <div className="flex items-center justify-between px-4 pb-2.5 pt-2 text-[0.92rem] font-medium">
          <span>{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-1 py-1 text-[0.8rem] text-ink-soft hover:text-ink"
          >
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
