"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";
import type { Database } from "./database.types";

type Client = ReturnType<typeof createBrowserClient<Database>>;

let cached: Client | null = null;

/**
 * ブラウザ側のクライアント。セッションはCookieに載るので、
 * サーバーコンポーネントからも同じユーザーとして読める。
 *
 * 鍵が無ければ null を返す。呼び出し側はモックのまま動く。
 */
export function getBrowserClient(): Client | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return cached;
}

/**
 * 匿名サインイン。
 *
 * **訪問しただけでは呼ばない。** 最初の書き込みが起きた時点で初めて発行する。
 * 匿名ユーザーもMAUとして数えられるので、閲覧だけの人にまで作ると
 * 課金対象と auth.users が無駄に膨らむ。
 * 「使い始めるまでの摩擦をゼロにする」（CLAUDE.md 5章）はこれで保てる。
 */
export async function ensureSession(): Promise<string | null> {
  const supabase = getBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("[supabase] 匿名サインインに失敗", error);
    return null;
  }
  return signedIn.user?.id ?? null;
}
