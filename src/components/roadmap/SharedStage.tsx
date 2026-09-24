"use client";

import { useState } from "react";

import { BookSpine } from "@/components/roadmap/BookSpine";
import { Shelf } from "@/components/roadmap/Shelf";
import { DetailSheet } from "@/components/sheets/DetailSheet";
import type { Book, RoadmapStage } from "@/types/roadmap";

type Props = {
  stage: RoadmapStage;
  index: number;
  books: Record<string, Book>;
  priority: boolean;
};

/**
 * 共有ページの段。
 *
 * **編集画面と同じ棚を出す。** 作った人が見ていた画面と別物にすると、
 * 同じサービスに見えない。棚と紐はこのアプリの見た目そのものなので、
 * 外から来た人が最初に見る画面から外さない（CLAUDE.md 8章）。
 *
 * ただし**他人の進捗は出さない**（玉は数字のまま、終了の印も棚板の線も無し）。
 *
 * 参考書を押すと**編集画面と同じ詳細シート**が読み取り専用で開く。
 * 専用のシートを別に作ると、同じ情報が2通りの並びで出ることになる。
 */
export function SharedStage({ stage, index, books, priority }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const selected = stage.items.find((i) => i.id === openId) ?? null;
  const selectedBook = selected ? (books[selected.bookId] ?? null) : null;

  return (
    <section>
      <Shelf stage={stage} index={index} readOnly onOpenItem={setOpenId}>
        {stage.items.map((item, i) => {
          const book = books[item.bookId];
          if (!book) return null;
          return (
            <BookSpine
              key={item.id}
              item={item}
              book={book}
              readOnly
              priority={priority && i < 2}
              onOpen={setOpenId}
            />
          );
        })}
      </Shelf>

      <DetailSheet
        item={selected}
        book={selectedBook}
        onClose={() => setOpenId(null)}
        readOnly
      />
    </section>
  );
}
