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
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { RoadmapSensor } from "@/lib/dnd/roadmap-sensor";
import type { Book, RoadmapItem } from "@/types/roadmap";

import { StopRow } from "./StopRow";
import type { RouteListProps } from "./StaticRoute";

/**
 * 並び替えできる経路。dnd-kit を読むのはこのモジュールだけで、
 * 初期バンドルから外すために遅延読み込みされる（CLAUDE.md 10章）。
 */
export function SortableRoute({
  items,
  books,
  onToggleDone,
  onOpen,
  onReorder,
}: RouteListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // センサーは1つだけ登録する。2つ登録すると後勝ちで上書きされて無言で壊れる
  // （理由は roadmap-sensor.ts と CLAUDE.md 9章）
  const sensors = useSensors(
    useSensor(RoadmapSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  const activeBook = activeItem ? books[activeItem.bookId] : null;

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => {
          const book = books[item.bookId];
          if (!book) return null;
          return (
            <SortableStop
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
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {activeItem && activeBook ? (
          <StopRow item={activeItem} book={activeBook} index={activeIndex} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableStop({
  item,
  book,
  index,
  onToggleDone,
  onOpen,
  priority,
}: {
  item: RoadmapItem;
  book: Book;
  index: number;
  onToggleDone: (itemId: string) => void;
  onOpen: (itemId: string) => void;
  priority: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <StopRow
      item={item}
      book={book}
      index={index}
      onToggleDone={onToggleDone}
      onOpen={onOpen}
      priority={priority}
      drag={{
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        isDragging,
        // dnd-kit の listeners / attributes をカード本体にまとめて渡す。
        // 型の形は違うが実体はどちらも DOM に付く属性とハンドラ
        cardProps: { ...listeners, ...attributes } as HTMLAttributes<HTMLDivElement>,
      }}
    />
  );
}
