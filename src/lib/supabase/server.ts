import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";
import type { Database } from "./database.types";

/**
 * サーバー側のクライアント。ブラウザが置いたCookieからセッションを読む。
 *
 * 共有ページはセッションを持たない訪問者にも配信されるので、その場合は
 * anon ロールとして動く。どの行が見えるかはRLSが決める（アプリ側で判定しない）。
 */
export async function getServerClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // サーバーコンポーネントからはCookieを書けない。
          // セッションの更新は proxy.ts が担当するのでここは無視してよい
        }
      },
    },
  });
}
