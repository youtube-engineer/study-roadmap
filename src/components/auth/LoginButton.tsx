"use client";

import { useCallback, useEffect, useState } from "react";

import { Sheet } from "@/components/sheets/Sheet";
import { Toast } from "@/components/ui/Toast";
import { PersonIcon } from "@/components/ui/icons";
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
 * 切り替える前に開いていたルート。
 * 持ち込みでidが変わるので、戻ってきたときに追いかけるために控えておく。
 */
export const CARRY_RETURN_ID = "carryReturnRoadmapId";

/**
 * 切り替えの説明を一度見たか。
 *
 * localStorage に置く。sessionStorage だとタブを閉じるたびに初回に戻り、
 * 「毎回同じ確認が出る」状態に逆戻りする。
 */
const SEEN_SWITCH_NOTICE = "seenAccountSwitchNotice";

/**
 * このGoogleアカウントは既にアカウントとして存在している、と分かった印。
 *
 * 一度そうと分かれば次も同じ結果になるので、**以降は昇格を試さない。**
 * 試すと必ず失敗して、切り替えのためにもう一度Googleへ行くことになる
 * ——ログインし直すたびに2回ログインさせられる、という形で出る。
 */
const LINK_UNAVAILABLE = "accountAlreadyExists";

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
  const [state, setState] = useState<SessionState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [account, setAccount] = useState(false);

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

    // 開いていたルートを控える。持ち込みでidが変わるので、
    // 戻り先を `next` のURLに固定できない
    const current = /^\/roadmaps\/([^/?#]+)/.exec(next)?.[1];
    if (current) sessionStorage.setItem(CARRY_RETURN_ID, current);

    setConflict(false);
    await switchToGoogleAccount("/");
  }, [next]);

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
    const reason = params.get("reason");
    if (!login) return;

    // 戻る操作で同じ処理が再び走らないよう、URLから消しておく
    params.delete("login");
    params.delete("reason");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));

    // 分岐はすべて副作用の外（マイクロタスク）へ寄せる。
    // 効果の本体で直接 setState するとレンダーが連鎖する
    void Promise.resolve().then(async () => {
      if (login === "ok") {
        setToast("ログインしました");
        return;
      }

      if (login !== "taken") {
        // 入れなかったのだから持ち込みもしない。残すと次に開いたときに走る
        sessionStorage.removeItem(CARRY_FLAG);
        sessionStorage.removeItem(CARRY_RETURN_ID);

        /**
         * **理由を隠さない。** access_denied は「本人がやめた」ことも
         * 「Google側に拒否された」（同意画面がテスト中で、そのアカウントが
         * テストユーザーに入っていない等）ことも意味する。黙って引き下がると
         * 何が起きたのか分からなくなる。
         */
        setToast(reason ? `ログインできませんでした（${reason}）` : "ログインできませんでした");
        return;
      }

      // 次からは昇格を試さない。同じ結果にしかならない
      remember(LINK_UNAVAILABLE);

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

    /**
     * ★ **持ち込みの目印は、どの入り口から入っても立てる。**
     *
     * 以前は「既に紐づいている」で切り替えたときだけ立てていた。だが
     * **セッションが無い状態で押すと `signInWithOAuth` に入る**
     * （`startGoogleLogin` は匿名ユーザーが居るときしか昇格を試さない）。
     * その経路には目印が無かったので、**ログインする前に作ったロードマップが
     * アカウントに入らないまま手元にだけ残っていた。**
     * 画面には出るので気付きにくく、端末を変えると消えたように見える。
     *
     * 持ち込みは冪等（既に自分のものはそのまま）なので、昇格が成功した
     * ときに通っても何も起きない。
     */
    sessionStorage.setItem(CARRY_FLAG, "1");
    const current = /^\/roadmaps\/([^/?#]+)/.exec(next)?.[1];
    if (current) sessionStorage.setItem(CARRY_RETURN_ID, current);

    /**
     * 昇格を試す価値があるか。
     *
     * - 手元に何も無い（ログアウト直後など）… 守るものが無い
     * - 既に「そのアカウントは在る」と分かっている … 試しても必ず失敗する
     *
     * どちらでも最初から `signInWithOAuth` に行く。**Googleへの往復が1回で済む。**
     * 手元のぶんは持ち込みが運ぶので失われない。
     */
    const hasLocalWork = (await listLocal()).length > 0;
    const keepAnonymousWork = hasLocalWork && !remembered(LINK_UNAVAILABLE);

    try {
      await startGoogleLogin(next, keepAnonymousWork);
    } catch (e) {
      console.error("[login]", e);
      const detail = e instanceof Error ? e.message.slice(0, 60) : "";
      setToast(detail ? `ログインを開始できません（${detail}）` : "ログインを開始できません");
    }
  }, [next]);

  const logout = useCallback(async () => {
    /**
     * ログインの往復で使う目印を残さない。残ったまま次のログインへ入ると、
     * 身に覚えのない持ち込みが走ったり、切り替えが即失敗したりする。
     */
    try {
      sessionStorage.removeItem(CARRY_FLAG);
      sessionStorage.removeItem(SWITCH_ATTEMPTED);
      sessionStorage.removeItem(CARRY_RETURN_ID);
    } catch {
      /* 使えない環境でも動作は変わらない */
    }

    await signOut();

    /**
     * ★ **読み込み直す。`router.push` では前の描画が残る。**
     *
     * App Router はルーターキャッシュを持っているので、`push("/")` は
     * **ログイン中に作られた RSC の結果**をそのまま出せてしまう。
     * そこに入っているのは当然そのアカウントの一覧なので、
     * **ログアウトしたのにログイン後のロードマップが降りてくる。**
     * `refresh()` を後から呼んでも、入口の画面は先に動いてしまっている。
     */
    window.location.replace("/");
  }, []);

  const loggedIn = Boolean(state?.signedIn && !state.anonymous);
  const initial = state?.email?.trim()?.[0]?.toUpperCase() ?? null;

  return (
    <>
      {/*
        ログイン中かどうかは**見れば分かる形**にする。ボタンの文字が
        「ログイン」か「ログアウト」かの違いだけだと、どちらの状態なのか
        読み取るのに一拍かかる。
      */}
      {state === null ? (
        // 判定が終わるまでの場所取り。文字が入れ替わってちらつくのを避ける
        <span
          aria-hidden="true"
          className="h-7 w-7 flex-none rounded-full border border-rule"
        />
      ) : loggedIn ? (
        <button
          type="button"
          onClick={() => setAccount(true)}
          aria-label="アカウント"
          title={state?.email ?? undefined}
          className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent-soft text-[0.72rem] font-bold text-accent-strong hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {initial ?? <PersonIcon size={13} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={login}
          className="flex-none rounded-full border border-rule-strong px-3 py-1 text-[0.75rem] text-ink-soft hover:border-ink-faint hover:bg-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ログイン
        </button>
      )}

      <Sheet open={account} onClose={() => setAccount(false)} title="アカウント">
        <div className="flex flex-col gap-4 px-4 pb-5 pt-1">
          <div className="flex items-center gap-2.5 rounded-[10px] bg-sunk px-3.5 py-3">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent-soft text-[0.8rem] font-bold text-accent-strong">
              {initial ?? <PersonIcon size={15} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.86rem]">
                {state?.email ?? "Googleアカウント"}
              </span>
              <span className="block text-[0.72rem] text-ink-faint">
                ロードマップは端末を変えても残ります
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setAccount(false);
              void logout();
            }}
            className="w-full rounded-[10px] border border-rule-strong px-4 py-2.5 text-[0.86rem] text-ink-soft hover:border-thread hover:text-thread"
          >
            ログアウト
          </button>
        </div>
      </Sheet>

      <Sheet
        open={conflict}
        onClose={() => setConflict(false)}
        title="このアカウントには既に記録があります"
      >
        <div className="flex flex-col gap-4 px-4 pb-5 pt-1">
          <p className="text-[0.87rem] leading-[1.8] text-ink-soft">
            選んだGoogleアカウントには、別の記録が既にあります。そちらを開くと、
            いまこの端末にある
            {localCount > 0 ? `${localCount}本のロードマップ` : "ロードマップ"}
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
