"use client";

import { useState } from "react";
import type { HTMLAttributes } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { RoadmapSensor } from "@/lib/dnd/roadmap-sensor";
import type { Book, RoadmapItem } from "@/types/roadmap";

import { BookSpine } from "./BookSpine";

export type BooksProps = {
  items: RoadmapItem[];
  books: Record<string, Book>;
  onOpen: (itemId: string) => void;
  /** 同じ段の中だけ。段をまたぐ移動は詳細シートから */
  onReorder: (activeId: string, overId: string) => void;
};

/**
 * 棚の中で本を並べ替える。
 *
 * **段をまたぐ移動はここではできない。** 段が変わると縦の移動になり、
 * 棚の横スクロール（pan-x）と取り合いになる。段をまたぐのは詳細シートから。
 *
 * dnd-kit は初回表示に不要なので、Shelf 側で遅延読み込みしている（10章）。
 */
export function SortableBooks({ items, books, onOpen, onReorder }: BooksProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // センサーは1つだけ登録する。2つ登録すると後勝ちで上書きされて無言で壊れる（9章）
  const sensors = useSensors(
    useSensor(RoadmapSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const activeBook = activeItem ? books[activeItem.bookId] : null;

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // 棚の中の移動なので、縦には動かさない
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={onDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
        {items.map((item) => {
          const book = books[item.bookId];
          if (!book) return null;
          return <SortableBook key={item.id} item={item} book={book} onOpen={onOpen} />;
        })}
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {activeItem && activeBook ? (
          <BookSpine item={activeItem} book={activeBook} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableBook({
  item,
  book,
  onOpen,
}: {
  item: RoadmapItem;
  book: Book;
  onOpen: (itemId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <BookSpine
      item={item}
      book={book}
      onOpen={onOpen}
      drag={{
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        isDragging,
        dragProps: { ...listeners, ...attributes } as HTMLAttributes<HTMLDivElement>,
      }}
    />
  );
}
