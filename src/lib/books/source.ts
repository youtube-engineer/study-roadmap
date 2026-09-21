import "server-only";

import type { Book } from "@/types/roadmap";
import { mockFindMany, mockSearch } from "./mock-source";
import { findByIsbn, isRakutenConfigured, listPopular, searchByTitle } from "./rakuten";

/**
 * 書誌データの取得経路。**ここが唯一の入口。**
 *
 * CLAUDE.md 7章「書誌データの取得経路を1箇所に抽象化しておくこと」の実体。
 * 有料化のタイミングで楽天から国立国会図書館サーチ / openBD / 自前蓄積へ
 * 差し替えることになるが、書き換えるのはこのファイルと同階層のクライアントだけ。
 *
 * RAKUTEN_APPLICATION_ID が設定されていれば楽天、無ければモックに落ちる。
 * アプリIDを .env.local に入れた時点で本番の経路に切り替わる。
 */

export function usingLiveSource(): boolean {
  return isRakutenConfigured();
}

/**
 * 参考書を探す。
 *
 * **何も打っていないときは人気の参考書を返す。** 空の一覧を出すと、
 * 打ち始めた瞬間にシートが伸びて入力欄が動く。それに「何を置けばいいのか」の
 * 見当もつかない。楽天は検索条件が空だと弾くので、ジャンルで引く。
 */
export async function searchBooks(query: string): Promise<Book[]> {
  if (!isRakutenConfigured()) return mockSearch(query);
  const q = query.trim();
  if (!q) return listPopular();
  return searchByTitle(q);
}

/**
 * ロードマップに載っている本をまとめて引く。
 *
 * TODO(Supabase): 本来ここは books テーブル（ISBNをキーにした表示用キャッシュ）を読む。
 * キャッシュに無いものだけ ISBN で引き直して書き戻す、が最終形。
 * 今はキャッシュが無いので毎回引いている。
 */
export async function getBooks(ids: readonly string[]): Promise<Book[]> {
  if (!isRakutenConfigured()) return mockFindMany(ids);
  const books = await Promise.all(ids.map((id) => findByIsbn(id)));
  return books.filter((b): b is Book => b !== null);
}
