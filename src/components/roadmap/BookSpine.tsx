"use client";

import Image from "next/image";
import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";

import { CheckIcon } from "@/components/ui/icons";
import { GRIP_ATTRIBUTE } from "@/lib/dnd/roadmap-sensor";
import type { Book, RoadmapItem } from "@/types/roadmap";

/** 棚に立つ本の大きさ。表紙が読める大きさであることが優先（8章） */
export const BOOK_WIDTH = 88;
export const BOOK_HEIGHT = 120;

/**
 * 本の下端の握り。指で取れる高さを確保する（9章）。
 *
 * **常に見えていること。** ホバーで出す作りにしたらタッチ端末で事実上
 * 見えなくなった（ホバーが無いので）。掴めることが分からなければ無いのと同じ。
 */
const GRIP_HEIGHT = 26;

export type DragBindings = {
  setNodeRef: (element: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  /** dnd-kit の listeners と attributes をまとめたもの */
  dragProps: HTMLAttributes<HTMLDivElement>;
};

type Props = {
  item: RoadmapItem;
  book: Book;
  onOpen?: (itemId: string) => void;
  drag?: DragBindings;
  /** DragOverlay の中身として描くとき */
  overlay?: boolean;
};

/**
 * 棚に立っている1冊。
 *
 * 表紙が唯一の彩り（CLAUDE.md 8章）なので、ここだけは画像をそのまま見せる。
 * 表紙が無いとき（手入力した教材、取得できなかったもの）は書名から決めた色で
 * 帯を作り、書名を小さく載せる。**レイアウトが崩れないことが条件**（7章）。
 */
export function BookSpine({ item, book, onOpen, drag, overlay = false }: Props) {
  const open = () => onOpen?.(item.id);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
      return;
    }
    drag?.dragProps.onKeyDown?.(e);
  };

  return (
    <div
      ref={overlay ? undefined : drag?.setNodeRef}
      style={{ width: BOOK_WIDTH, ...(overlay ? {} : drag?.style) }}
      /*
        **<button> にしない。** センサーはボタンの上でドラッグを始めない作りに
        してあるので（誤爆を防ぐため）、ボタンにすると握りが効かなくなる。
      */
      role={overlay ? undefined : "button"}
      tabIndex={overlay ? undefined : 0}
      aria-label={overlay ? undefined : book.title}
      onClick={overlay ? undefined : open}
      onKeyDown={overlay ? undefined : onKeyDown}
      {...(overlay ? {} : drag?.dragProps)}
      className={`relative flex-none snap-start touch-pan-x focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
        drag?.isDragging ? "opacity-30" : ""
      } ${overlay ? "cursor-grabbing" : ""}`}
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
        className={`relative block overflow-hidden rounded-[2px_5px_5px_2px] ${
          overlay ? "shadow-lift" : "shadow-book"
        } ${item.isDone ? "opacity-55" : ""}`}
        style={{ width: BOOK_WIDTH, height: BOOK_HEIGHT }}
      >
        {book.coverImageUrl ? (
          <Image
            src={book.coverImageUrl}
            alt=""
            width={BOOK_WIDTH}
            height={BOOK_HEIGHT}
            unoptimized
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center px-1.5 text-center text-[0.66rem] leading-tight text-white"
            style={{
              background: `linear-gradient(160deg, hsl(${book.hue} 42% 44%), hsl(${book.hue + 22} 38% 28%))`,
            }}
          >
            {book.title.slice(0, 16)}
          </span>
        )}

        {/* 背表紙。左だけ影と光を入れて厚みを出す */}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-black/30" />
        <span aria-hidden="true" className="absolute inset-y-0 left-1 w-[1.5px] bg-white/20" />

        {/*
          終了の印は**表紙の内側**に置く。外へはみ出すと、棚が縦にも
          スクロールできる状態になって本が上下にずれる。
          下端は握りなので、重ならないよう右上へ。
        */}
        {item.isDone && (
          <span className="absolute right-1 top-1 grid h-[22px] w-[22px] place-items-center rounded-full bg-thread text-white shadow-[0_0_0_2px_rgba(255,255,255,0.75)]">
            <CheckIcon size={11} />
          </span>
        )}

        {/*
          本の下端が握り。**ここだけ touch-action: none** にして、つまんだ瞬間から
          動かせるようにする（9章）。棚そのものは pan-x のままなので横スクロールは
          そのまま効く。この2つはセットで意味を持つ。
        */}
        {!overlay && (
          <span
            {...{ [GRIP_ATTRIBUTE]: "" }}
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 flex cursor-grab touch-none items-center justify-center border-t border-black/15 bg-[#f4f1ea] transition-colors active:bg-[#e6e1d6]"
            style={{ height: GRIP_HEIGHT }}
          >
            <svg viewBox="0 0 30 4" width="26" height="4" className="fill-black/30">
              <circle cx="4" cy="2" r="1.4" />
              <circle cx="11" cy="2" r="1.4" />
              <circle cx="18" cy="2" r="1.4" />
              <circle cx="25" cy="2" r="1.4" />
            </svg>
          </span>
        )}
      </span>
    </div>
  );
}
