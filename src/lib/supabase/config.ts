/**
 * Supabase の接続情報。
 *
 * 鍵が入っていなければアプリはモックで動く。楽天APIと同じ扱いで、
 * 環境変数を入れた時点で本物に切り替わる。
 *
 * NEXT_PUBLIC_ の変数はビルド時に埋め込まれるので、process.env.X の形で
 * そのまま書く必要がある（動的なキーだと置換されない）。
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** 新しいプロジェクトは publishable key、古いものは anon key と表示される。どちらも同じ用途 */
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
