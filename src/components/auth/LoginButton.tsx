"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Sheet } from "@/components/sheets/Sheet";
import { listLocal } from "@/lib/db/local";
import {
  getSessionState,
  signOut,
  startGoogleLogin,
  switchToGoogleAccount,
  type SessionState,
} from "@/lib/supabase/auth";

/** 既存アカウントへ切り替えた後、手元のぶんを持っていくための目印 */
export const CARRY_FLAG = "carryAfterSignIn";

type Props = {
  /** ログイン後に戻ってくる場所 */
  next: string;
};

export function LoginButton({ next }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [conflict, setConflict] = useState(false);
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    let alive = true;
    getSessionState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 昇格が「既に別のユーザーに紐づいている」で失敗すると ?login=taken で戻ってくる。
   * useSearchParams を使わないのは、Suspense 境界を足さずに済ませるため
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") !== "taken") return;

    listLocal().then((rows) => {
      setLocalCount(rows.length);
      setConflict(true);
    });

    // 戻る操作で同じ確認が何度も出ないよう、URLから消しておく
    params.delete("login");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, []);

  const login = useCallback(async () => {
    try {
      await startGoogleLogin(next);
    } catch (e) {
      console.error("[login]", e);
    }
  }, [next]);

  const switchAccount = useCallback(async () => {
    // 切り替わった後に持っていく。実際の作り直しは一覧側で走る
    sessionStorage.setItem(CARRY_FLAG, "1");
    await switchToGoogleAccount("/");
  }, []);

  const loggedIn = Boolean(state?.signedIn && !state.anonymous);

  const logout = useCallback(async () => {
    await signOut();
    router.push("/");
    // サーバーコンポーネントが持っている一覧も取り直す
    router.refresh();
  }, [router]);

  const onClick = loggedIn ? logout : login;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title={state?.email ?? undefined}
        className="flex-none rounded-full border border-rule-strong px-3 py-1 text-[0.75rem] text-ink-soft hover:border-ink-faint hover:bg-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {loggedIn ? "ログアウト" : "ログイン"}
      </button>

      <Sheet
        open={conflict}
        onClose={() => setConflict(false)}
        title="このアカウントには既に記録があります"
      >
        <div className="flex flex-col gap-4 px-4 pb-5 pt-1">
          <p className="text-[0.87rem] leading-[1.8] text-ink-soft">
            選んだGoogleアカウントには、別の記録が既にあります。そちらを開くと、
            いまこの端末にある
            {localCount > 0 ? `${localCount}本のルート` : "ルート"}
            も一緒に持っていきます。
          </p>
          <p className="rounded-[10px] bg-sunk px-3.5 py-3 text-[0.79rem] leading-[1.75] text-ink-faint">
            元々そのアカウントにあったルートには手を触れません。持っていったぶんが
            増えるだけで、どちらも消えません。
          </p>

          <button
            type="button"
            onClick={switchAccount}
            className="w-full rounded-[10px] bg-accent px-4 py-3 text-[0.92rem] font-medium text-white hover:bg-accent-strong"
          >
            そちらの記録を開く
          </button>
          <button
            type="button"
            onClick={() => setConflict(false)}
            className="w-full py-1 text-[0.82rem] text-ink-soft underline underline-offset-[3px] hover:text-ink"
          >
            やめる（ログインせずに続ける）
          </button>
        </div>
      </Sheet>
    </>
  );
}
