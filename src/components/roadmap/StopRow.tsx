"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";

import { BookCover } from "@/components/ui/BookCover";
import { CheckIcon, GripIcon } from "@/components/ui/icons";
import { GRIP_ATTRIBUTE } from "@/lib/dnd/roadmap-sensor";
import type { Book, RoadmapItem } from "@/types/roadmap";

export type DragBindings = {
  setNodeRef: (element: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  /** dnd-kit の listeners と attributes をまとめたもの。カード本体に付ける */
  cardProps: HTMLAttributes<HTMLDivElement>;
};

type Props = {
  item: RoadmapItem;
  book: Book;
  index: number;
  onToggleDone?: (itemId: string) => void;
  onOpen?: (itemId: string) => void;
  /** 渡さなければ並び替えできない静的な行になる（dnd-kit 読み込み前のフォールバック） */
  drag?: DragBindings;
  /** DragOverlay の中身として描くとき。玉と握りを出さない */
  overlay?: boolean;
  priority?: boolean;
};

export function StopRow({
  item,
  book,
  index,
  onToggleDone,
  onOpen,
  drag,
  overlay = false,
  priority = false,
}: Props) {
  // ドラッグ直後の click でシートが開いてしまうのを抑える
  const draggedRecently = useRef(false);
  const isDragging = drag?.isDragging ?? false;

  useEffect(() => {
    if (isDragging) {
      draggedRecently.current = true;
      return;
    }
    if (!draggedRecently.current) return;
    const t = setTimeout(() => {
      draggedRecently.current = false;
    }, 140);
    return () => clearTimeout(t);
  }, [isDragging]);

  const open = () => {
    if (draggedRecently.current) return;
    onOpen?.(item.id);
  };

  const dndKeyDown = drag?.cardProps.onKeyDown;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      open();
      return;
    }
    // Space での掴み上げなどは dnd-kit に渡す
    dndKeyDown?.(event);
  };

  return (
    <div
      ref={overlay ? undefined : drag?.setNodeRef}
      style={overlay ? undefined : drag?.style}
      className={`flex items-stretch gap-3 ${overlay ? "pl-[2.55rem]" : ""}`}
    >
      {!overlay && (
        <div className="relative flex w-[22px] flex-none justify-center">
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 w-[3px] rounded-sm bg-thread transition-opacity duration-200 ${
              item.isDone ? "opacity-100" : "opacity-[0.34]"
            }`}
          />
          <button
            type="button"
            aria-pressed={item.isDone}
            aria-label={
              item.isDone ? `${book.title} を未完了に戻す` : `${book.title} を終了にする`
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone?.(item.id);
            }}
            className={`relative mt-5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-thread p-0 font-mono text-[0.67rem] shadow-[0_0_0_3px_var(--raised)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent ${
              item.isDone
                ? "bg-thread text-white"
                : "bg-raised text-thread hover:bg-thread-soft"
            }`}
          >
            {item.isDone ? <CheckIcon /> : index + 1}
          </button>
        </div>
      )}

      {/* カード本体は touch-action: pan-y のままにしてスクロールを通す（CLAUDE.md 9章） */}
      <div
        {...(overlay ? {} : drag?.cardProps)}
        role={overlay ? undefined : "button"}
        tabIndex={overlay ? undefined : 0}
        onClick={overlay ? undefined : open}
        onKeyDown={overlay ? undefined : handleKeyDown}
        className={`my-2 flex min-w-0 flex-1 touch-pan-y cursor-grab items-center gap-3 rounded-[10px] border py-[0.6rem] pl-[0.7rem] pr-0 text-left transition-[background-color,border-color] duration-150 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          overlay
            ? "cursor-grabbing border-thread bg-raised shadow-lift"
            : item.isDone
              ? "border-rule bg-transparent hover:border-rule-strong"
              : "border-transparent bg-sunk hover:border-rule-strong"
        } ${isDragging ? "opacity-30" : "opacity-100"}`}
      >
        <BookCover book={book} priority={priority} className={item.isDone ? "opacity-50" : ""} />

        <div className="min-w-0 flex-1">
          <div
            className={`text-[0.89rem] font-medium leading-[1.45] ${
              item.isDone ? "text-ink-soft" : ""
            }`}
          >
            {book.title}
          </div>
          <div className="mt-[0.05rem] flex flex-wrap items-center gap-x-1.5 gap-y-0">
            <span className="text-[0.71rem] text-ink-faint">{book.author}</span>
            {item.roundsTarget ? (
              <span className="font-mono text-[0.63rem] leading-[1.7] text-ink-soft before:mr-[0.34em] before:text-ink-faint before:content-['·']">
                {item.roundsTarget}周
              </span>
            ) : null}
            {item.note ? (
              <span className="font-mono text-[0.63rem] leading-[1.7] text-amber before:mr-[0.34em] before:text-ink-faint before:content-['·']">
                メモ
              </span>
            ) : null}
          </div>
        </div>

        {/* 握りだけ touch-action: none。幅50px・カード全高を確保しないと指で取れない */}
        {!overlay && (
          <span
            {...{ [GRIP_ATTRIBUTE]: "" }}
            aria-hidden="true"
            className="-my-[0.6rem] grid w-[50px] flex-none touch-none cursor-grab place-items-center self-stretch rounded-r-[10px] text-rule-strong transition-colors hover:bg-thread-soft hover:text-thread active:bg-thread-soft active:text-thread"
          >
            <GripIcon className="pointer-events-none fill-current" />
          </span>
        )}
      </div>
    </div>
  );
}
