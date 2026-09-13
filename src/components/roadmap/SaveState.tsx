"use client";

import { useEffect, useState } from "react";

import { getSessionState, onAuthChange } from "@/lib/supabase/auth";

/**
 * 保存の状態（CLAUDE.md 13章）。
 *
 * ログインしているかどうかを、**それが何をもたらすか**で示す。
 * 「ログイン済み」と書くより、「この端末にだけ保存」と出ている方が、
 * ログインする理由が同時に伝わる（画面設計 02 の言い方に合わせた）。
 */
export function SaveState({ ready }: { ready: boolean }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () => {
      getSessionState().then((s) => {
        if (alive) setSignedIn(s.signedIn && !s.anonymous);
      });
    };

    read();
    const unsubscribe = onAuthChange(read);

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  if (!ready || signedIn === null) return null;

  return (
    <span className="mb-2 inline-flex items-center gap-1.5 font-mono text-[0.6rem] text-ink-faint">
      <span
        aria-hidden="true"
        className={`h-[5px] w-[5px] rounded-full ${
          signedIn ? "bg-thread opacity-70" : "bg-ink-faint opacity-60"
        }`}
      />
      {signedIn ? "アカウントに保存済み" : "この端末にだけ保存"}
    </span>
  );
}
