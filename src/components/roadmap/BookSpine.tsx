"use client";

import Image from "next/image";

import { CheckIcon } from "@/components/ui/icons";
import type { Book, RoadmapItem } from "@/types/roadmap";

const WIDTH = 74;
const HEIGHT = 101;

type Props = {
  item: RoadmapItem;
  book: Book;
  onOpen: (itemId: string) => void;
};

/**
 * 棚に立っている1冊。
 *
 * 表紙が唯一の彩り（CLAUDE.md 8章）なので、ここだけは画像をそのまま見せる。
 * 表紙が無いとき（手入力した教材、取得できなかったもの）は書名から決めた色で
 * 帯を作り、書名を小さく載せる。**レイアウトが崩れないことが条件**（7章）。
 */
export function BookSpine({ item, book, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-label={book.title}
      className="relative flex-none snap-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      style={{ width: WIDTH }}
    >
      {/* 周回の目標とメモの印は棚板の上に出す。表紙を隠さない */}
      <span className="flex h-[17px] items-end justify-between px-px">
        {item.roundsTarget ? (
          <span className="font-mono text-[0.7rem] leading-none text-ink-faint">
            {item.roundsTarget}周
          </span>
        ) : (
          <span />
        )}
        {item.note ? (
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-[2px] bg-amber opacity-85"
            title="メモあり"
          />
        ) : null}
      </span>

      <span
        className={`relative block overflow-hidden rounded-[2px_5px_5px_2px] shadow-card ${
          item.isDone ? "opacity-55" : ""
        }`}
        style={{ width: WIDTH, height: HEIGHT }}
      >
        {book.coverImageUrl ? (
          <Image
            src={book.coverImageUrl}
            alt=""
            width={WIDTH}
            height={HEIGHT}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center px-1.5 text-center text-[0.62rem] leading-tight text-white"
            style={{
              background: `linear-gradient(160deg, hsl(${book.hue} 42% 44%), hsl(${book.hue + 22} 38% 28%))`,
            }}
          >
            {book.title.slice(0, 14)}
          </span>
        )}
        {/* 背表紙。左だけ影と光を入れて厚みを出す */}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-black/30" />
        <span aria-hidden="true" className="absolute inset-y-0 left-1 w-[1.5px] bg-white/20" />
      </span>

      {item.isDone && (
        <span className="absolute -bottom-1.5 -right-1.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-thread text-white shadow-[0_0_0_2.5px_var(--raised)]">
          <CheckIcon size={11} />
        </span>
      )}
    </button>
  );
}
