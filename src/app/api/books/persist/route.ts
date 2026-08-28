import { NextResponse } from "next/server";

import { persistBook } from "@/lib/books/persist";
import type { Book } from "@/types/roadmap";

/**
 * 検索で選ばれた本を books に載せて、その id を返す。
 *
 * ブラウザは books に書き込む権限を持たないので、必ずここを通す。
 * 返ってきた id が roadmap_items.book_id になる。
 */
export async function POST(request: Request) {
  const book = (await request.json()) as Book;

  if (!book?.title) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const id = await persistBook(book);
  if (!id) {
    // Supabase 未設定のときはここに来る。呼び出し側はモックのまま動く
    return NextResponse.json({ id: null });
  }
  return NextResponse.json({ id });
}
