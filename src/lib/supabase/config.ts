/**
 * Supabase の接続情報。
 *
 * 鍵が入っていなければアプリはモックで動く。楽天APIと同じ扱いで、
 * 環境変数を入れた時点で本物に切り替わる。
 *
 * NEXT_PUBLIC_ の変数はビルド時に埋め込まれるので、process.env.X の形で
 * そのまま書く必要がある（動的なキーだと置換されない）。
 */

/**
 * **空文字を「無い」として扱う。**
 *
 * `??` は null / undefined のときしか代替に切り替わらない。Vercel では
 * 名前だけ作られて値が空、という状態が普通に起きるので、`??` で繋ぐと
 * 空の鍵をそのまま送ってしまい `Invalid API key` になる。実際になった。
 */
export function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export const SUPABASE_URL = firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * 新しいプロジェクトは publishable key、古いものは anon key と表示される。
 * Vercel の Supabase 連携は NEXT_PUBLIC_SUPABASE_ANON_KEY という名前で入れる。
 * どれも同じ用途なので、値が入っている最初のものを使う。
 */
export const SUPABASE_PUBLISHABLE_KEY = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
