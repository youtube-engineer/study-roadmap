import { NextResponse } from "next/server";

import { searchBooks } from "@/lib/books/source";
import { BookSearchTimeoutError } from "@/lib/books/rakuten";

/**
 * 参考書検索。
 *
 * ブラウザから楽天を直接叩かず必ずここを通す。アプリIDを他者に知られないよう
 * 保管する義務（楽天ウェブサービス規約 第5条2項）があるため（CLAUDE.md 7章）。
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";

  try {
    const books = await searchBooks(query);
    return NextResponse.json({ books });
  } catch (e) {
    if (e instanceof BookSearchTimeoutError) {
      // 「該当なし」とは別の表現に切り替えられるよう、種類を返す（CLAUDE.md 10章）
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    console.error("[books/search]", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
