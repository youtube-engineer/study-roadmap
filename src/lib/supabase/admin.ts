import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./config";
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
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !secret) return null;

  return createClient<Database>(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
