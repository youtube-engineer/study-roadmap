"use client";

import type { Book, RoadmapItem } from "@/types/roadmap";

import { StopRow } from "./StopRow";

export type RouteListProps = {
  items: RoadmapItem[];
  books: Record<string, Book>;
  onToggleDone: (itemId: string) => void;
  onOpen: (itemId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
};

/**
 * 並び替えのできない経路。dnd-kit のチャンクが届くまでのあいだ表示する。
 * 空の枠ではなく本物の経路を出すので、読む分には最初から成立している。
 */
export function StaticRoute({ items, books, onToggleDone, onOpen }: RouteListProps) {
  return (
    <>
      {items.map((item, index) => {
        const book = books[item.bookId];
        if (!book) return null;
        return (
          <StopRow
            key={item.id}
            item={item}
            book={book}
            index={index}
            onToggleDone={onToggleDone}
            onOpen={onOpen}
            priority={index < 2}
          />
        );
      })}
    </>
  );
}
