import { BookCover } from "@/components/ui/BookCover";
import type { Book, RoadmapStage } from "@/types/roadmap";

type Props = {
  stage: RoadmapStage;
  index: number;
  books: Record<string, Book>;
};

/**
 * 共有ページの段。
 *
 * **編集画面の読み取り専用コピーにはしない。メモを開かずに読める形にする**
 * ——他人のルートを見る価値はまさにそのメモにある（CLAUDE.md 8章）。
 * だから棚に立てず、縦に積んで本文を見せる。
 *
 * 玉は数字のまま。終了の印は出さない（他人の進捗ではなく計画として読ませる）。
 */
export function SharedStage({ stage, index, books }: Props) {
  return (
    <section className="relative pl-[46px] pr-4">
      <span className="absolute inset-y-0 left-[15px] flex w-[22px] justify-center">
        <span aria-hidden="true" className="absolute inset-y-0 w-[3px] rounded-sm bg-thread opacity-70" />
        <span className="relative z-[2] mt-0.5 grid h-6 w-6 place-items-center self-start rounded-full border-[2.5px] border-thread bg-raised font-mono text-[0.72rem] text-thread shadow-[0_0_0_4px_var(--raised)]">
          {index + 1}
        </span>
      </span>

      <div className="flex min-h-7 items-baseline gap-2">
        <span className="text-[1rem] font-bold">{stage.name || "　"}</span>
        <span className="ml-auto flex-none font-mono text-[0.72rem] text-ink-faint">
          {stage.items.length}冊
        </span>
      </div>

      <div className="mt-1 flex flex-col gap-2">
        {stage.items.map((item, i) => {
          const book = books[item.bookId];
          if (!book) return null;
          return (
            <div key={item.id} className="rounded-[10px] bg-sunk px-3.5 py-3">
              <div className="flex items-center gap-3">
                <BookCover book={book} priority={index === 0 && i < 2} />
                <div className="min-w-0 flex-1">
                  <div className="text-[0.89rem] font-medium leading-[1.45]">{book.title}</div>
                  <div className="mt-[0.05rem] flex flex-wrap items-center gap-x-1.5">
                    <span className="text-[0.71rem] text-ink-faint">{book.author}</span>
                    {item.roundsTarget ? (
                      <span className="font-mono text-[0.63rem] leading-[1.7] text-ink-soft before:mr-[0.34em] before:text-ink-faint before:content-['·']">
                        {item.roundsTarget}周
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {item.note ? (
                <p className="mt-2.5 border-t border-rule pt-2 text-[0.82rem] leading-[1.75] text-ink-soft">
                  {item.note}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
