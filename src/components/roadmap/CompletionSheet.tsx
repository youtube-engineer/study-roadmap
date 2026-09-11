"use client";

import { useEffect, useState } from "react";

import { Sheet } from "@/components/sheets/Sheet";
import { FlagIcon } from "@/components/ui/icons";
import { getSessionState, startGoogleLogin } from "@/lib/supabase/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 走りきった冊数 */
  count: number;
  /** 共有シートを開く */
  onShare: () => void;
  /** ログイン後に戻ってくる場所 */
  next: string;
};

/**
 * 走りきったとき（画面設計 08）。
 *
 * 全部終わった瞬間は**誇りが最大化する一点**なので、共有とログインの両方をここに置く。
 * 順序も意図的で、**共有を上・ログインを下**にしている——アカウントより先に、
 * 外に出ることを勧める。共有が伸びるかどうかで全部が決まる（CLAUDE.md 12章）。
 *
 * ログインは「機能を開ける鍵」ではなく**「消えないようにする手段」**として出す。
 */
export function CompletionSheet({ open, onClose, count, onShare, next }: Props) {
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getSessionState().then((s) => {
      if (alive) setSignedIn(s.signedIn && !s.anonymous);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="走りきった">
      <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
        <div className="flex justify-center">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-thread text-white shadow-[0_0_0_6px_var(--thread-soft)]">
            <FlagIcon size={15} />
          </span>
        </div>

        <p className="text-center font-serif text-[1.05rem] font-semibold leading-[1.45]">
          {count}冊ぜんぶ、走りきった
        </p>
        <p className="text-center text-[0.8rem] leading-[1.85] text-ink-soft">
          組んだルートを最後まで通した記録は、
          <br />
          これから同じところを目指す人の役に立つ。
        </p>

        <button
          type="button"
          onClick={() => {
            onClose();
            onShare();
          }}
          className="mt-1 w-full rounded-[10px] bg-accent px-4 py-3 text-[0.92rem] font-medium text-white hover:bg-accent-strong"
        >
          このルートを共有する
        </button>

        {!signedIn && (
          <button
            type="button"
            onClick={() => void startGoogleLogin(next)}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-rule-strong bg-raised px-4 py-2.5 text-[0.86rem] font-medium text-ink hover:bg-sunk"
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 flex-none rounded-full"
              style={{
                background:
                  "conic-gradient(#EA4335 0 25%, #FBBC05 0 50%, #34A853 0 75%, #4285F4 0)",
              }}
            />
            ログインして残す
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-1 text-center text-[0.78rem] text-ink-faint hover:text-ink-soft"
        >
          あとで
        </button>
      </div>
    </Sheet>
  );
}
