import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * OAuth から戻ってくる先。
 *
 * 認可コードをセッションに交換して、元いた画面へ返す。
 * Cookie を書けるのは Route Handler と Server Action だけなので、
 * ここで交換する必要がある（サーバーコンポーネントからは書けない）。
 *
 * ⚠ **セッションのCookieは、返すレスポンスに自分で載せること。**
 * next/headers の cookies() に書いても、こちらで作った NextResponse には
 * 乗らない。乗らないままリダイレクトすると、ログインしたのにセッションが
 * 残らない——「ログインできない」の形で現れる。
 */

/** そのGoogleアカウントが既に別のユーザーに紐づいている場合の合図 */
function isAlreadyLinked(description: string | null, code: string | null): boolean {
  const text = `${description ?? ""} ${code ?? ""}`.toLowerCase();
  return (
    text.includes("already") ||
    text.includes("identity_already_exists") ||
    text.includes("user_already_exists")
  );
}

type PendingCookie = { name: string; value: string; options: Record<string, unknown> };

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  const target = new URL(next, url.origin);

  const errorDescription = url.searchParams.get("error_description");
  const errorCode = url.searchParams.get("error_code") ?? url.searchParams.get("error");

  if (errorDescription || errorCode) {
    // 本人が Google の画面で「キャンセル」したときは失敗として扱わない
    const cancelled = `${errorCode ?? ""}`.toLowerCase().includes("access_denied");
    target.searchParams.set(
      "login",
      cancelled ? "cancelled" : isAlreadyLinked(errorDescription, errorCode) ? "taken" : "failed",
    );
    console.warn("[auth/callback]", errorCode, errorDescription);
    return NextResponse.redirect(target);
  }

  const code = url.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) return NextResponse.redirect(target);

  // 交換の途中で渡されるCookieを溜めておき、最後にレスポンスへ載せる
  const pending: PendingCookie[] = [];

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          pending.push({ name, value, options: (options ?? {}) as Record<string, unknown> });
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchange", error.message);
    target.searchParams.set("login", isAlreadyLinked(error.message, null) ? "taken" : "failed");
    return NextResponse.redirect(target);
  }

  const response = NextResponse.redirect(target);
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, options);
  }
  return response;
}
