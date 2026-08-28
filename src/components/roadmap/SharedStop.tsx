import { BookCover } from "@/components/ui/BookCover";
import type { Book, RoadmapItem } from "@/types/roadmap";

type Props = {
  item: RoadmapItem;
  book: Book;
  index: number;
  priority?: boolean;
};

/**
 * 共有ページの1冊。
 *
 * 編集画面の読み取り専用コピーにはしない。他人のルートを見る価値はメモにあるので、
 * シートを開かせず本文として展開する。番号の点は数字のままにして終了の印は出さない
 * ——他人の進捗ではなく計画として読ませるため（CLAUDE.md 8章）。
 */
export function SharedStop({ item, book, index, priority = false }: Props) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="relative flex w-[22px] flex-none justify-center">
        <span aria-hidden="true" className="absolute inset-y-0 w-[3px] rounded-sm bg-thread opacity-70" />
        <span className="relative mt-5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-thread bg-raised font-mono text-[0.67rem] text-thread shadow-[0_0_0_3px_var(--raised)]">
          {index + 1}
        </span>
      </div>

      <div className="my-2 min-w-0 flex-1 rounded-[10px] bg-sunk px-3.5 py-3">
        <div className="flex items-center gap-3">
          <BookCover book={book} priority={priority} />
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
    </div>
  );
}
