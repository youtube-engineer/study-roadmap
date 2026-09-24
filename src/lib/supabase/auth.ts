"use client";

import { clearLocal } from "@/lib/db/local";

import { getBrowserClient } from "./client";

/**
 * Googleログイン。
 *
 * **匿名ユーザーは昇格させる**（CLAUDE.md 5章）。`linkIdentity()` はユーザーIDを
 * 変えないので、それまでに作ったロードマップがそのまま自分のものとして残る。
 * データ移行のコードが要らないのがこの方式を選んだ理由。
 *
 * ただしそのGoogleアカウントが既に別のユーザーに紐づいていると失敗する。
 * そのときだけ `signInWithOAuth()` に切り替えて既存アカウントへ入り、
 * 手元の作りかけは新しい所有者のもとに作り直す（lib/roadmaps/carry.ts）。
 * **黙って統合も、黙って破棄もしない。**
 */

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export type SessionState = {
  signedIn: boolean;
  /** 匿名のまま使っている状態。ログインするとfalseになる */
  anonymous: boolean;
  email: string | null;
};

const EMPTY: SessionState = { signedIn: false, anonymous: true, email: null };

/** 本アカウントに紐づいているか。匿名ユーザーは identity を持たない */
function linked(user: { is_anonymous?: boolean; identities?: unknown[] | null }): boolean {
  return user.is_anonymous === false || (user.identities ?? []).length > 0;
}

/**
 * いまログインしているか。**ボタンの出し分けにしか使わない。**
 *
 * ★ **手元のセッションで判定する。通信を挟まない。**
 *
 * 以前は毎回 `getUser()`（＝Supabaseへの往復）で確かめていたが、
 * 失敗したときに EMPTY を返していたので、**セッションは生きているのに
 * 「ログインしていない」ことになって「ログイン」ボタンが出ていた。**
 * ログイン直後は carry や refresh で通信が立て込むので、そこで一番起きやすい。
 * 画面が切り替わるたびに往復していたぶん、出るまでの間も空いていた。
 *
 * ここが決めるのはボタンの表示だけで、**誰が何を読めるかは RLS が決める**
 * （CLAUDE.md 6章）。だから手元の値を信じてよい。
 */
export async function getSessionState(): Promise<SessionState> {
  const supabase = getBrowserClient();
  if (!supabase) return EMPTY;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return EMPTY;

  const user = session.user;
  if (linked(user)) return { signedIn: true, anonymous: false, email: user.email ?? null };

  /**
   * 手元のセッションが匿名に見えるときだけサーバーに確かめる。
   *
   * `is_anonymous` は linkIdentity() で昇格しても発行時のまま
   * `true` を主張し続けることがあるため（CLAUDE.md 14章）。
   * ここで失敗しても EMPTY には落とさない。**セッションはあるのだから
   * ログアウト扱いにしてはいけない。**
   */
  const {
    data: { user: fresh },
  } = await supabase.auth.getUser();

  if (!fresh) return { signedIn: true, anonymous: true, email: null };

  return { signedIn: true, anonymous: !linked(fresh), email: fresh.email ?? null };
}

/**
 * ログインを始める。
 *
 * - 匿名で使っている → 昇格を試す（今のデータを保ったままにする）
 * - まだ何も無い     → そのままログイン（失うものが無い）
 */
export async function startGoogleLogin(next: string, keepAnonymousWork = true): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const options = { redirectTo: callbackUrl(next) };

  // 匿名かどうかは identity の有無で見る（is_anonymous は古いままのことがある）
  const anonymous = user !== null && !linked(user);

  /**
   * ★ **昇格を試すのは、守るものがあるときだけ。**
   *
   * `linkIdentity()` の目的は「匿名のまま作ったものを、IDを変えずに残す」こと。
   * 守るものが無いときに試すと、そのGoogleアカウントが既にアカウントとして
   * 存在する場合に必ず失敗し、**切り替えのためにもう一度Googleへ行かされる。**
   * ログイン→ログアウト→またログイン、で毎回2往復になる
   * （説明を一度見た後は確認も出ないので、ただ2回ログインさせられたように見える）。
   *
   * `keepAnonymousWork` が false のときは最初から `signInWithOAuth`。
   * 手元のぶんは持ち込み（carry.ts）が運ぶので、失うものは無い。
   */
  if (anonymous && keepAnonymousWork) {
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options });
  if (error) throw error;
}

/**
 * 既存アカウントへ入る。**今の匿名ユーザーからは切り替わる。**
 * 昇格が「既に紐づいている」で失敗し、ユーザーがそれを選んだときだけ呼ぶ。
 */
export async function switchToGoogleAccount(next: string): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error) throw error;
}

/**
 * ログイン状態の変化を購読する。
 *
 * 一度読んだきりにすると、ログアウトしてもボタンが「ログアウト」のまま残る。
 * 別のタブでログインした場合も追従できる。
 */
export function onAuthChange(callback: () => void): () => void {
  const supabase = getBrowserClient();
  if (!supabase) return () => {};

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(() => callback());

  return () => subscription.unsubscribe();
}

/**
 * ログアウト。**手元のものも消す。**
 *
 * 残すと、次に匿名で書き始めたときに所有者の違う行へ書こうとして RLS に
 * 弾かれ続ける（手元では動いて見えるのにサーバーには何も入らない）。
 * 別のアカウントの記録を端末に残さないためでもある。
 *
 * ログアウトできるのはログイン済みのときだけなので、消えるのは
 * 「サーバーにもある記録」。ログインし直せば戻る。
 */
export async function signOut(): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
  await clearLocal();
}
