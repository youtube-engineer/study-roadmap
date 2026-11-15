import { NextResponse } from "next/server";

import { persistBook } from "@/lib/books/persist";
import type { Book } from "@/types/roadmap";

/**
 * 検索で選ばれた本を books に載せて、その id を返す。
 *
 * ブラウザは books に書き込む権限を持たないので、必ずここを通す。
 * 返ってきた id が roadmap_items.book_id になる。
 */
/** 画面に出る文字の上限。これを超えるものは正当な書誌データではない */
const MAX = { title: 300, author: 200, isbn: 20, year: 10, id: 100 } as const;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const raw = (body ?? {}) as Partial<Book>;
  const title = clip(raw.title, MAX.title);
  if (!title) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  /**
   * ★ **送られてきた値をそのまま渡さない。**
   *
   * ここは**匿名で叩ける**（アプリがログイン不要なので塞げない）。
   * 受け取った形のまま保存すると、`source_url` が `<a href>` に、
   * `cover_image_url` が `<img src>` になって**共有ページに出る**。
   * 使う項目だけを、長さを切って組み直す。URLの検査は persist.ts。
   */
  const book: Book = {
    id: clip(raw.id, MAX.id) ?? crypto.randomUUID(),
    title,
    author: clip(raw.author, MAX.author) ?? "",
    isbn: clip(raw.isbn, MAX.isbn),
    source: raw.source === "rakuten" || raw.source === "openbd" ? raw.source : "manual",
    publishedYear: clip(raw.publishedYear, MAX.year),
    coverImageUrl: typeof raw.coverImageUrl === "string" ? raw.coverImageUrl : null,
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null,
    hue: typeof raw.hue === "number" && Number.isFinite(raw.hue) ? raw.hue : 0,
  };

  const id = await persistBook(book);
  if (!id) {
    // Supabase 未設定のときはここに来る。呼び出し側はモックのまま動く
    return NextResponse.json({ id: null });
  }
  return NextResponse.json({ id });
}
