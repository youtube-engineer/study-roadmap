"use client";

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

export async function getSessionState(): Promise<SessionState> {
  const supabase = getBrowserClient();
  if (!supabase) return { signedIn: false, anonymous: false, email: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { signedIn: false, anonymous: false, email: null };
  return {
    signedIn: true,
    anonymous: Boolean(user.is_anonymous),
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

  if (user?.is_anonymous) {
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

export async function signOut(): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
