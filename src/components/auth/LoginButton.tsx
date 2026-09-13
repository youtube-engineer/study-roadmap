"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Sheet } from "@/components/sheets/Sheet";
import { Toast } from "@/components/ui/Toast";
import { listLocal } from "@/lib/db/local";
import {
  getSessionState,
  onAuthChange,
  signOut,
  startGoogleLogin,
  switchToGoogleAccount,
  type SessionState,
} from "@/lib/supabase/auth";

/** 切り替えた後、手元のぶんを持っていくための目印 */
export const CARRY_FLAG = "carryAfterSignIn";

/** 切り替えを一度試したことを覚えておく。失敗が続いたときに往復し続けないため */
export const SWITCH_ATTEMPTED = "loginSwitchAttempted";

/**
 * 切り替えの説明を一度見たか。
 *
 * localStorage に置く。sessionStorage だとタブを閉じるたびに初回に戻り、
 * 「毎回同じ確認が出る」状態に逆戻りする。
 */
const SEEN_SWITCH_NOTICE = "seenAccountSwitchNotice";

function remembered(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    // プライベートウィンドウなどで読めないことがある。
    // そのときは「まだ見ていない」扱いでよい（説明が出るだけ）
    return false;
  }
}

function remember(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* 覚えられなくても動作は変わらない */
  }
}

type Props = {
  /** ログイン後に戻ってくる場所 */
  next: string;
};

export function LoginButton({ next }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = () => {
      getSessionState().then((s) => {
        if (!alive) return;
        setState(s);
        // ログインが通ったらガードは役目を終えている
        if (s.signedIn && !s.anonymous) sessionStorage.removeItem(SWITCH_ATTEMPTED);
      });
    };

    read();
    // 購読しないと、ログアウトしてもボタンが「ログアウト」のまま残る
    const unsubscribe = onAuthChange(read);

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const startSwitch = useCallback(async () => {
    remember(SEEN_SWITCH_NOTICE);
    sessionStorage.setItem(SWITCH_ATTEMPTED, "1");
    sessionStorage.setItem(CARRY_FLAG, "1");
    setConflict(false);
    await switchToGoogleAccount("/");
  }, []);

  /**
   * 昇格（linkIdentity）が「既に別のユーザーに紐づいている」で失敗すると
   * ?login=taken で戻ってくる。
   *
   * **説明は最初の一度だけ出す。** 何が起きるか（既存の記録を開き、手元のぶんは
   * 一緒に持っていく）を一度伝えれば、二度目以降は同じ結果になると分かっている。
   * 毎回止めると、新しい端末を使うたびに同じ確認を読まされることになる。
   *
   * useSearchParams を使わないのは、Suspense 境界を足さずに済ませるため。
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    if (!login) return;

    // 戻る操作で同じ処理が再び走らないよう、URLから消しておく
    params.delete("login");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));

    // 分岐はすべて副作用の外（マイクロタスク）へ寄せる。
    // 効果の本体で直接 setState するとレンダーが連鎖する
    void Promise.resolve().then(async () => {
      if (login === "cancelled") {
        // 本人がGoogleの画面でやめただけ。失敗として騒がない
        return;
      }

      if (login !== "taken") {
        setToast("ログインできませんでした");
        return;
      }

      if (sessionStorage.getItem(SWITCH_ATTEMPTED)) {
        // 一度切り替えを試してまた弾かれた。往復し続けても直らない
        sessionStorage.removeItem(SWITCH_ATTEMPTED);
        setToast("ログインできませんでした");
        return;
      }

      if (remembered(SEEN_SWITCH_NOTICE)) {
        await startSwitch();
        return;
      }

      const rows = await listLocal();
      setLocalCount(rows.length);
      setConflict(true);
    });
  }, [startSwitch]);

  const login = useCallback(async () => {
    /**
     * 往復を防ぐガードは**1回のログイン操作の中でだけ**効かせる。
     * 押すたびに消さないと、一度キャンセルしただけで以降ずっと
     * 「ログインできませんでした」が出続ける。
     */
    sessionStorage.removeItem(SWITCH_ATTEMPTED);
    try {
      await startGoogleLogin(next);
    } catch (e) {
      console.error("[login]", e);
      setToast("ログインできませんでした");
    }
  }, [next]);

  const logout = useCallback(async () => {
    await signOut();
    router.push("/");
    // サーバーコンポーネントが持っている一覧も取り直す
    router.refresh();
  }, [router]);

  const loggedIn = Boolean(state?.signedIn && !state.anonymous);

  return (
    <>
      <button
        type="button"
        onClick={loggedIn ? logout : login}
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
            <br />
            次からはこの確認を出さずに開きます。
          </p>

          <button
            type="button"
            onClick={startSwitch}
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

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
