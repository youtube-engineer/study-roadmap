import { NextResponse } from "next/server";

import { getServerClient } from "@/lib/supabase/server";

/**
 * OAuth から戻ってくる先。
 *
 * 認可コードをセッションに交換して、元いた画面へ返す。
 * Cookie を書けるのは Route Handler と Server Action だけなので、
 * ここで交換する必要がある（サーバーコンポーネントからは書けない）。
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  const target = new URL(next, url.origin);

  const errorDescription = url.searchParams.get("error_description");
  const errorCode = url.searchParams.get("error_code") ?? url.searchParams.get("error");

  if (errorDescription || errorCode) {
    // 昇格に失敗した理由で分岐する。「既に紐づいている」だけは
    // ユーザーに選ばせる余地があるので、画面側で確認を出す。
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
  if (!code) return NextResponse.redirect(target);

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.redirect(target);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchange", error);
    target.searchParams.set("login", isAlreadyLinked(error.message, null) ? "taken" : "failed");
  }

  return NextResponse.redirect(target);
}
