"use client";

import { useState } from "react";

import { BookSpine } from "@/components/roadmap/BookSpine";
import { Shelf } from "@/components/roadmap/Shelf";
import { Sheet } from "@/components/sheets/Sheet";
import { BookCover } from "@/components/ui/BookCover";
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
 * 読む側に関係が無く、計画として読ませたいため。
 *
 * **押せばメモが読める。** 他人のロードマップを見る価値はそこにあるので、
 * 参考書を開く道だけは用意する。
 */
export function SharedStage({ stage, index, books, priority }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const selected = stage.items.find((i) => i.id === openId);
  const selectedBook = selected ? books[selected.bookId] : undefined;

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

      <Sheet
        open={Boolean(selected && selectedBook)}
        onClose={() => setOpenId(null)}
        title="参考書"
      >
        {selected && selectedBook ? (
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-5 pt-1.5">
            <div className="flex items-start gap-3.5">
              <BookCover book={selectedBook} />
              <div className="min-w-0 flex-1">
                <div className="text-[0.95rem] font-bold leading-[1.45] text-ink-title">
                  {selectedBook.title}
                </div>
                <div className="mt-1 text-[0.78rem] text-ink-faint">{selectedBook.author}</div>
                {selected.roundsTarget ? (
                  <div className="mt-1.5 font-mono text-[0.72rem] text-ink-soft">
                    {selected.roundsTarget}周やる
                  </div>
                ) : null}
              </div>
            </div>

            {selected.note ? (
              <p className="whitespace-pre-wrap border-t border-rule pt-3.5 text-[0.86rem] leading-[1.8] text-ink-soft">
                {selected.note}
              </p>
            ) : (
              <p className="border-t border-rule pt-3.5 text-[0.82rem] text-ink-faint">
                この参考書にメモはありません。
              </p>
            )}

            {/*
              楽天ウェブサービス規約 第8条4項。書誌データを出している画面には
              楽天サイトへのリンクを置く（CLAUDE.md 7章）
            */}
            {selectedBook.sourceUrl ? (
              <a
                href={selectedBook.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[10px] bg-accent px-4 py-2.5 text-center text-[0.86rem] font-bold text-white hover:brightness-95"
              >
                楽天ブックスで見る
              </a>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
