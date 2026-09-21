import "server-only";

import type { Book } from "@/types/roadmap";

import { hueFromTitle } from "./hue";

/**
 * 楽天ブックス書籍検索API クライアント。
 *
 * ここだけが楽天と通信する。呼び出し側（source.ts より上）は楽天を知らない。
 *
 * 規約まわりで外してはいけない点（CLAUDE.md 7章）:
 *   - アプリIDはサーバーサイドからのみ使う。ブラウザに出したら第5条2項に触れる
 *   - 応募タイプは「ウェブアプリケーション」で登録する。
 *     「API/バックエンドサービス」だとIP許可リストになり、Vercelの動的IPで詰む
 *   - 雑誌検索APIではなく書籍検索API（BooksBook/Search）を使う
 *   - ジャンルでは絞らない。ユーザーは書名で探すので取りこぼしのリスクだけ増える
 */

const ENDPOINT =
  "https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404";

/** 検索のタイムアウト。「該当なし」とは別のエラーとして扱う（CLAUDE.md 10章） */
export const SEARCH_TIMEOUT_MS = 5000;

export class BookSearchTimeoutError extends Error {
  constructor() {
    super("楽天ブックスAPIが時間内に応答しませんでした");
    this.name = "BookSearchTimeoutError";
  }
}

export class BookSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookSearchError";
  }
}

/** formatVersion=2 のときの Items 要素。使うものだけ宣言する */
type RakutenItem = {
  title?: string;
  author?: string;
  publisherName?: string;
  isbn?: string;
  itemUrl?: string;
  salesDate?: string;
  largeImageUrl?: string;
  mediumImageUrl?: string;
  smallImageUrl?: string;
};

type RakutenResponse = {
  Items?: RakutenItem[];
  error?: string;
  error_description?: string;
};

/**
 * アクセスキー。ポータルでは「access key」、APIのパラメータ名は applicationId。
 * 呼び方が違うだけで同じもの。
 *
 * 空文字を「無い」として扱うのは Supabase の鍵と同じ理由（14章）。
 * Vercel では名前だけ作られて値が空、という状態が普通に起きる。
 */
function accessKey(): string {
  return process.env.RAKUTEN_ACCESS_KEY?.trim() ?? "";
}

export function isRakutenConfigured(): boolean {
  return Boolean(accessKey());
}

/** 「2024年03月15日」「2024年3月」→「2024」 */
function toYear(salesDate: string | undefined): string | null {
  const m = salesDate?.match(/(\d{4})/);
  return m ? m[1] : null;
}

function toBook(item: RakutenItem): Book | null {
  const title = item.title?.trim();
  if (!title) return null;
  const isbn = item.isbn?.trim() || null;
  return {
    // ISBNが取れたものはISBNをそのままIDにする。国際標準の識別子なので
    // 提供元を切り替えても引き直せる（CLAUDE.md 6章）
    id: isbn ?? `rakuten:${item.itemUrl ?? title}`,
    isbn,
    source: "rakuten",
    title,
    author: item.author?.trim() || item.publisherName?.trim() || "",
    publishedYear: toYear(item.salesDate),
    // URLだけを持つ。画像ファイルは複製しない
    coverImageUrl:
      item.mediumImageUrl || item.largeImageUrl || item.smallImageUrl || null,
    sourceUrl: item.itemUrl ?? null,
    hue: hueFromTitle(title),
  };
}

async function call(params: Record<string, string>): Promise<RakutenItem[]> {
  const key = accessKey();
  if (!key) {
    throw new BookSearchError("RAKUTEN_ACCESS_KEY が設定されていません");
  }

  const url = new URL(ENDPOINT);
  // パラメータ名は applicationId のまま。ポータルの表示名だけが access key
  url.searchParams.set("applicationId", key);
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("hits", "20");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  if (affiliateId) url.searchParams.set("affiliateId", affiliateId);

  // ⚠ 未検証: アプリID登録を「ウェブアプリケーション」（＝ドメイン許可）にした場合、
  // サーバーサイドの fetch は Origin/Referer を自動送信しないので弾かれる可能性がある。
  // 弾かれたら RAKUTEN_REFERER に登録ドメインを入れて明示的に送る（CLAUDE.md 7章）。
  const headers: HeadersInit = {};
  const referer = process.env.RAKUTEN_REFERER;
  if (referer) headers.Referer = referer;

  let res: Response;
  try {
    res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      // 書誌データは頻繁に変わらないので1日キャッシュする。
      // 呼び出し回数を減らすのは想定QPSを守るためでもある
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new BookSearchTimeoutError();
    }
    throw new BookSearchError("楽天ブックスAPIに接続できませんでした");
  }

  if (!res.ok) {
    throw new BookSearchError(`楽天ブックスAPIが ${res.status} を返しました`);
  }

  const json = (await res.json()) as RakutenResponse;
  if (json.error) {
    throw new BookSearchError(json.error_description ?? json.error);
  }
  return json.Items ?? [];
}

/** 書名で探す。ユーザーは書名で探すので title に入れる */
export async function searchByTitle(query: string): Promise<Book[]> {
  const items = await call({ title: query });
  return items.map(toBook).filter((b): b is Book => b !== null);
}

export async function findByIsbn(isbn: string): Promise<Book | null> {
  const items = await call({ isbn });
  const book = items.map(toBook).find((b): b is Book => b !== null);
  return book ?? null;
}
