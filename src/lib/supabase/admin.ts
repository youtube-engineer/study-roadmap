import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL, firstNonEmpty } from "./config";
import type { Database } from "./database.types";

/**
 * RLSを迂回するクライアント。**books への書き込みだけに使う。**
 *
 * books は誰のものでもない表示用キャッシュなので所有者で守れない。
 * 代わりに「書き込めるのはサーバーの1経路だけ」という形にしてある
 * （RLSに書き込みポリシーを作らず、GRANTも渡していない。CLAUDE.md 7章）。
 *
 * ロードマップ本体の読み書きには絶対に使わないこと。
 * 使うとアクセス制御がRLSから漏れてアプリ側に散る。
 */
export function getAdminClient() {
  // Vercel の Supabase 連携が入れる名前（SUPABASE_SERVICE_ROLE_KEY）も受ける。
  // 同じ鍵を2つの名前で置かせるのは、片方を更新し忘れる事故のもとなので。
  // 空文字を「無い」として扱うのは config.ts と同じ理由
  const secret = firstNonEmpty(
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (!SUPABASE_URL || !secret) return null;

  return createClient<Database>(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
