import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * セッションの更新。
 *
 * Supabase のアクセストークンは短命で、期限が切れるとサーバーコンポーネントから
 * ユーザーが見えなくなる。サーバーコンポーネントはCookieを書けないので、
 * リクエストごとにここで更新してCookieを載せ替える。
 *
 * Next.js 16 では middleware.ts ではなく proxy.ts がこの位置づけ。
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() / getUser() を呼ぶことでトークンの更新が走る。
  // ここを消すとセッションが静かに切れる
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // 静的ファイルと画像は通さない
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
