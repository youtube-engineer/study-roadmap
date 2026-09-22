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

export async function getSessionState(): Promise<SessionState> {
  const supabase = getBrowserClient();
  if (!supabase) return EMPTY;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY;

  /**
   * **is_anonymous を信用しない。**
   *
   * linkIdentity() で昇格しても、手元にあるトークンは発行時のまま
   * `is_anonymous: true` を主張し続ける（更新されるまで古い claim が残る）。
   * それを見て判定すると、ログインしてもボタンが「ログイン」のまま残る。
   *
   * 紐づいた identity があるかどうかで見る。匿名ユーザーは identity を持たない。
   */
  const linked = (user.identities ?? []).length > 0;

  return {
    signedIn: true,
    anonymous: !linked,
    email: user.email ?? null,
  };
}

/**
 * ログインを始める。
 *
 * - 匿名で使っている → 昇格を試す（今のデータを保ったままにする）
 * - まだ何も無い     → そのままログイン（失うものが無い）
 */
export async function startGoogleLogin(next: string): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const options = { redirectTo: callbackUrl(next) };

  // 匿名かどうかは identity の有無で見る（is_anonymous は古いままのことがある）
  const anonymous = user !== null && (user.identities ?? []).length === 0;

  if (anonymous) {
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
