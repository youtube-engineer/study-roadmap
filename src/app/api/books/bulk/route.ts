import { NextResponse } from "next/server";

import { searchBooks } from "@/lib/books/source";
import type { Book } from "@/types/roadmap";

/**
 * まとめて貼り付けた書名を、1行ずつ参考書に当てる。
 *
 * ★ **何を入れるかは決まっていて、入れる作業だけが面倒**という場面のため。
 * 28冊を検索→追加で28往復するのが、最初の1本を完成させる一番の壁だった。
 *
 * AIに本を選ばせるのとは別物。**選ぶのは人で、探す手間だけを肩代わりする。**
 */

/** 一度に扱う上限。多すぎると楽天のレート制限（毎秒1回）で時間がかかりすぎる */
const MAX_LINES = 40;

/**
 * 楽天は**毎秒1回**まで（CLAUDE.md 7章）。超えると 429 が返る。
 * 1行ずつ順番に、間を空けて当てる。
 */
const INTERVAL_MS = 1100;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BulkHit = {
  /** 打ち込まれた行そのまま。画面で「この行はこれに当たった」を見せるため */
  query: string;
  /** 見つかった候補。先頭が最有力 */
  candidates: Book[];
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const raw = (body as { lines?: unknown })?.lines;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const lines = raw
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES);

  const results: BulkHit[] = [];
  for (const [i, query] of lines.entries()) {
    if (i > 0) await wait(INTERVAL_MS);
    try {
      const books = await searchBooks(query);
      // 候補は3つまで。全部見せると選ぶのが仕事になる
      results.push({ query, candidates: books.slice(0, 3) });
    } catch {
      // 1行こけても止めない。見つからなかった扱いで進む
      results.push({ query, candidates: [] });
    }
  }

  return NextResponse.json({ results });
}
