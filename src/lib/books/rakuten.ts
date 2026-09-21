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

/**
 * 2026年の刷新で新ドメインへ移行した。旧 `app.rakuten.co.jp` は停止済み。
 */
const ENDPOINT =
  "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";

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
 * 新方式は**2つとも要る**（2026年の刷新から）。
 *
 * - `RAKUTEN_APPLICATION_ID` … UUID形式。クエリの applicationId
 * - `RAKUTEN_ACCESS_KEY`     … `pk_…`。accessKey ヘッダー
 *
 * 片方だけだと 400 が返る。旧方式のアプリIDは使えないので、アプリを
 * 登録し直す必要がある。
 *
 * 空文字を「無い」として扱うのは Supabase の鍵と同じ理由（14章）。
 * Vercel では名前だけ作られて値が空、という状態が普通に起きる。
 */
function applicationId(): string {
  return process.env.RAKUTEN_APPLICATION_ID?.trim() ?? "";
}

function accessKey(): string {
  return process.env.RAKUTEN_ACCESS_KEY?.trim() ?? "";
}

export function isRakutenConfigured(): boolean {
  return Boolean(applicationId() && accessKey());
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
  const appId = applicationId();
  const key = accessKey();
  if (!appId || !key) {
    throw new BookSearchError(
      "RAKUTEN_APPLICATION_ID と RAKUTEN_ACCESS_KEY の両方が必要です",
    );
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("applicationId", appId);
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("hits", "20");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  if (affiliateId) url.searchParams.set("affiliateId", affiliateId);

  /**
   * サーバーサイドの fetch は Origin を自動送信しないので、**自分で付ける**。
   * 付けないと 403 `REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING` が返る。
   *
   * 名前に反して `Referer` では通らない。**`Origin` でないと駄目**（実測）。
   * 値は楽天の許可リストに登録したドメイン。
   */
  const headers: HeadersInit = { accessKey: key };
  const origin = process.env.RAKUTEN_ORIGIN?.trim();
  if (origin) headers.Origin = origin.replace(/\/$/, "");

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

/**
 * 語学・学習参考書のジャンルID。
 *
 * **検索では使わない。** ユーザーは書名で探すので、ジャンルで絞ると
 * 取りこぼしのリスクだけ増える（CLAUDE.md 9章）。
 * 使うのは「何も打っていないときに何を並べるか」を決めるときだけ。
 */
const GENRE_STUDY_AIDS = "001002";

/**
 * 何も打っていないときに出す本。
 *
 * 並び順は指定しない。`sort=sales` にすると児童書や図鑑が上位を占めて
 * 参考書らしくなくなる（実測）。楽天の標準の並びがいちばん近い。
 */
export async function listPopular(): Promise<Book[]> {
  const items = await call({ booksGenreId: GENRE_STUDY_AIDS });
  return items.map(toBook).filter((b): b is Book => b !== null);
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
