import "server-only";

import { firstNonEmptyOrNull } from "@/lib/first-non-empty";
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
  /**
   * 楽天が返した状態コード。**文言ではなくこれで分岐する。**
   * 文言は楽天の都合で変わるし、`detail` にも同じ数字が混ざるので当てにならない。
   */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "BookSearchError";
    this.status = status;
  }
}

/** formatVersion=2 のときの Items 要素。使うものだけ宣言する */
type RakutenItem = {
  title?: string;
  author?: string;
  publisherName?: string;
  isbn?: string;
  itemUrl?: string;
  /** affiliateId を付けて呼んだときだけ返る。成果はこのURL経由でしか発生しない */
  affiliateUrl?: string;
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

/**
 * 許可リストに登録したドメイン。**これも必須。**
 *
 * サーバーサイドの fetch は Origin を自動送信しないので、無いと必ず 403 になる。
 * 空文字を「無い」として扱うのは鍵と同じ理由（Vercel では名前だけ作られて
 * 値が空、という状態が普通に起きる）。
 */
function originHeader(): string {
  return process.env.RAKUTEN_ORIGIN?.trim().replace(/\/$/, "") ?? "";
}

export function isRakutenConfigured(): boolean {
  return Boolean(applicationId() && accessKey());
}

/** 「2024年03月15日」「2024年3月」→「2024」 */
function toYear(salesDate: string | undefined): string | null {
  const m = salesDate?.match(/(\d{4})/);
  return m ? m[1] : null;
}

/**
 * 表紙のURL。
 *
 * 楽天は `?_ex=120x120` のような寸法をURLに載せてくる。棚に並べると粗いので
 * 大きめに差し替える。**URLだけを持つという約束は変えない**（画像は複製しない）。
 */
/**
 * 値が入っている最初のものを選ぶ。
 *
 * **楽天は「無い」を空文字で返す。** `affiliateUrl` はアフィリエイトIDを
 * 設定していないとき `""` になるので、`??` で繋ぐと空のまま採用されてしまう
 * （`??` は null / undefined のときしか代替に切り替わらない）。
 * Supabase の鍵で踏んだのと同じ罠（CLAUDE.md 14章）。
 */

function coverUrl(item: RakutenItem): string | null {
  const url = firstNonEmptyOrNull(item.largeImageUrl, item.mediumImageUrl, item.smallImageUrl);
  if (!url) return null;
  return url.replace(/_ex=\d+x\d+/, "_ex=240x240");
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
    author: firstNonEmptyOrNull(item.author, item.publisherName) ?? "",
    publishedYear: toYear(item.salesDate),
    // URLだけを持つ。画像ファイルは複製しない
    coverImageUrl: coverUrl(item),
    /**
     * 出典であり購入先。
     *
     * アフィリエイトIDを設定していれば affiliateUrl が返るので、そちらを優先する。
     * **成果はこのURL経由でしか発生しない。**
     *
     * なお楽天アフィリエイトを使う場合、楽天以外のアフィリエイトを併用することは
     * できない（規約 第10条1項(5)）。AmazonとRakutenは二択（CLAUDE.md 7章）。
     */
    sourceUrl: firstNonEmptyOrNull(item.affiliateUrl, item.itemUrl),
    hue: hueFromTitle(title),
  };
}

/**
 * ★ **429 は1度だけ待ってやり直す。**
 *
 * 楽天は**毎秒1回**（7章）。打った語を組み直して何度か試すので
 * （`variants`）、1回の検索でも複数回当たる。**2人が同じ秒に検索すれば
 * それだけで弾かれる。** 実測で `Rate limit is exceeded. Try again in
 * 1 seconds.` を確認した。
 *
 * 利用者から見ると「検索できませんでした」としか出ないので、
 * **言われたとおり1秒待ってもう一度だけ試す。** それでも駄目なら諦める
 * （延々待たせる方が悪い。検索は5秒で切る約束がある。10章）。
 */
async function call(params: Record<string, string>): Promise<RakutenItem[]> {
  try {
    return await callOnce(params);
  } catch (e) {
    if (!(e instanceof BookSearchError) || e.status !== 429) throw e;
    await new Promise((r) => setTimeout(r, RETRY_AFTER_MS));
    return callOnce(params);
  }
}

/** 楽天が「1秒後に」と言ってくるので、それより少しだけ長く待つ */
const RETRY_AFTER_MS = 1100;

async function callOnce(params: Record<string, string>): Promise<RakutenItem[]> {
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
  const origin = originHeader();
  if (!origin) {
    /**
     * 黙って送らずに、**理由を名指しで落とす。**
     * 付けなければ必ず 403 になるので、ここで止めた方が原因に辿り着ける。
     */
    throw new BookSearchError(
      "RAKUTEN_ORIGIN が空です（楽天の許可リストに登録したドメインを入れる）",
    );
  }
  const headers: HeadersInit = { accessKey: key, Origin: origin };

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
    /**
     * ★ **楽天が返した中身を捨てない。**
     *
     * 403 には種類があり、どちらなのかで直し方が変わる。
     *  - `HTTP_REFERRER_NOT_ALLOWED` … Origin が許可リストに無い
     *  - `REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING` … Origin を送っていない
     * 状態コードだけ残して捨てると、**本番で「失敗しました」としか分からなくなる。**
     */
    const body = await res.text().catch(() => "");
    const detail = body.replace(/\s+/g, " ").slice(0, 200);
    throw new BookSearchError(
      `楽天ブックスAPIが ${res.status} を返しました（Origin: ${origin}）${detail ? ` ${detail}` : ""}`,
      res.status,
    );
  }

  const json = (await res.json()) as RakutenResponse;
  if (json.error) {
    throw new BookSearchError(json.error_description ?? json.error);
  }
  return json.Items ?? [];
}

/**
 * 語学関係資格のジャンルID（英検・TOEICなど）。
 *
 * **検索では使わない。** ユーザーは書名で探すので、ジャンルで絞ると
 * 取りこぼしのリスクだけ増える（CLAUDE.md 9章）。
 * 使うのは「何も打っていないときに何を並べるか」を決めるときだけ。
 *
 * 親の `001002`（語学・学習参考書）や兄弟の `001002006`（学習参考書・問題集）だと、
 * 図鑑・ドリル・大学の赤本が上位を占めて参考書のランキングに見えない（実測）。
 * ここは焦点を英語・英検に置いている（3章）ので、その意味でも合っている。
 */
const GENRE_LANGUAGE_EXAMS = "001002005";

/**
 * 売れている参考書。何も打っていないときに出す。
 *
 * BooksにランキングAPIは無いので、ジャンルを絞って `sort=sales` で代用する。
 * IchibaのランキングAPIは別スコープが要るうえ、返るのが書誌ではなく商品なので使わない。
 */
export async function listPopular(): Promise<Book[]> {
  const items = await call({ booksGenreId: GENRE_LANGUAGE_EXAMS, sort: "sales" });
  return items.map(toBook).filter((b): b is Book => b !== null);
}

/** 書名で探す。ユーザーは書名で探すので title に入れる */
/**
 * ★ **打った語を、当たる形に組み直す。**
 *
 * 楽天の `title=` は**語順どおりの部分一致**で、空白で区切ると AND（順不同）になる。
 * そのまま渡すと通称がほぼ当たらない。実測した挙動:
 *
 * ```
 * ポラリス英文法2     0件   続けて書くと、その並びの書名しか当たらない
 * ポラリス 英文法      7件   空白で区切れば順不同で当たる
 * ポラリス 英文法 2    0件   ★ 数字を足すと落ちる
 * ```
 *
 * 数字が落ちるのは、書名では「ポラリス［2　応用レベル］」のように
 * **記号に挟まれて離れている**ため。巻数は人がよく打つのに、一番外れやすい。
 */
function variants(query: string): string[] {
  const q = query.trim().replace(/[\s　]+/g, " ");
  if (!q) return [];

  /**
   * 文字種の切れ目で分ける。
   *
   * ⚠ **英字と数字のあいだも切る。** 切らないと `rules3` が1語のままで、
   * 候補が1つも増えない（実際に当たらなかった）。
   *
   * ⚠ **「準1」「第2」のような接頭辞は切り離さない。** 切ると「準」だけが
   * 残って意味が壊れ、AND条件で全部落ちる。
   */
  const split = q
    .replace(/([\u3040-\u30ff\u4e00-\u9fff])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([\u3040-\u30ff\u4e00-\u9fff])/g, "$1 $2")
    .replace(/([\u4e00-\u9fff])([\u30a0-\u30ff])/g, "$1 $2")
    .replace(/([\u30a0-\u30ff])([\u4e00-\u9fff])/g, "$1 $2")
    // 英字と数字（rules3 → rules 3）
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    // かなカナ漢字と数字。ただし「準1」「第2」「級」などは残す
    .replace(/([\u3040-\u30ff\u4e00-\u9fff])([0-9])/g, (m, a, b) =>
      "準第全上下初中高".includes(a) ? m : `${a} ${b}`,
    )
    .replace(/\s+/g, " ")
    .trim();

  const words = split.split(" ");
  const noDigits = words.filter((w) => !/^[0-9]+$/.test(w)).join(" ");

  /** 語が多いときは、短い語（巻数や記号めいたもの）を落として本命だけ残す */
  const longOnly = words.filter((w) => w.length >= 2).join(" ");

  /**
   * 上から順に試して、最初に「関係がある」結果が出たものを採る。
   * **緩める方向にだけ進む。**
   */
  return [...new Set([q, split, noDigits, longOnly].filter(Boolean))];
}

/**
 * 打った語の「中身」がどれだけ書名に入っているか。
 *
 * ⚠ **1件でも返ったら当たり、とはしない。**
 * `rules3` は `EURO STYLE TRUCKS（3）` に当たってしまう（「3」だけの一致）。
 * **当たった気になって緩めるのをやめる**ので、本命に辿り着けない。
 */
function looksRelevant(query: string, books: Book[]): boolean {
  const words = query
    .toLowerCase()
    .split(/[\s　]+/)
    .filter((w) => w.length >= 2 && !/^[0-9]+$/.test(w));
  if (words.length === 0) return books.length > 0;

  /**
   * **一番長い語が入っているかで見る。** その語が打った内容の芯になっている
   * （「rules」「ポラリス」「ワークブック」）。
   * どれか1語でよしとすると `rules3` が `EURO STYLE TRUCKS（3）` に当たって
   * しまい、**当たった気になって緩めるのをやめる。**
   */
  const key = words.reduce((a, b) => (b.length > a.length ? b : a));
  return books.some((b) => b.title.toLowerCase().includes(key));
}

async function searchByTitle(query: string): Promise<Book[]> {
  let fallback: Book[] = [];

  for (const title of variants(query)) {
    const items = await call({ title });
    const books = items.map(toBook).filter((b): b is Book => b !== null);
    if (books.length === 0) continue;

    if (looksRelevant(title, books)) return books;
    // 関係が薄い結果しか無いときは、覚えておいて次の形を試す
    if (fallback.length === 0) fallback = books;
  }

  return fallback;
}

/**
 * 著者でも引くのは、書名の結果がこれに満たないとき。
 * `hits=20` なので、**1ページ埋まっていれば足りている**と見なす。
 */
const THIN = 20;

/**
 * ★ **書名で引いて、薄かったら著者でも引いて混ぜる。**
 *
 * 参考書は**書いた人で憶えていることがある**（「関正生の」「肘井の」
 * 「大岩の」）。`title=` でも著者名は部分一致でそこそこ当たるが、
 * **取りこぼしが大きい。** 実測:
 *
 * ```
 * 大岩秀樹   title   1件  /  author  30件   ← 1冊しか出ない
 * 肘井学     title  12件  /  author  42件
 * 関正生     title  42件  /  author 111件
 * ```
 *
 * 1件でも返ると `looksRelevant` が当たりと判定して止まるので、
 * **当たった気になって29冊を捨てる。** 一番困る外し方。
 *
 * ⚠ **いつも両方は叩かない。** 楽天は毎秒1回（7章）なので、
 * 足りているときに1往復足すと**全員の検索が遅くなる。**
 * 薄いときだけ払う。書名の結果を先に出すのは、打った人が
 * **書名のつもりで打っていることの方が多い**ため。
 */
export async function search(query: string): Promise<Book[]> {
  const byTitle = await searchByTitle(query);
  if (byTitle.length >= THIN) return byTitle;

  const author = query.trim().replace(/[\s　]+/g, " ");
  if (!author) return byTitle;

  const items = await call({ author });
  const byAuthor = items.map(toBook).filter((b): b is Book => b !== null);
  if (byAuthor.length === 0) return byTitle;

  const seen = new Set(byTitle.map((b) => b.id));
  return [...byTitle, ...byAuthor.filter((b) => !seen.has(b.id))];
}

export async function findByIsbn(isbn: string): Promise<Book | null> {
  const items = await call({ isbn });
  const book = items.map(toBook).find((b): b is Book => b !== null);
  return book ?? null;
}
