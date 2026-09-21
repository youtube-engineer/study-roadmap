"use client";

import { useState } from "react";
import type { HTMLAttributes } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { RoadmapSensor } from "@/lib/dnd/roadmap-sensor";
import type { Book, RoadmapStage } from "@/types/roadmap";

import { BookSpine } from "./BookSpine";
import { Shelf } from "./Shelf";
import type { ShelfHandlers } from "./Shelf";

/** 空の段にも落とせるようにするための目印 */
const DROP_PREFIX = "drop:";

export type RoadmapListProps = ShelfHandlers & {
  stages: RoadmapStage[];
  books: Record<string, Book>;
  /** 参考書を（別の段かもしれない）位置へ移す。toIndex が null なら末尾 */
  onMoveItem: (itemId: string, toStageId: string, toIndex: number | null) => void;
  /** 段の並び替え */
  onReorderStages: (activeId: string, overId: string) => void;
};

/**
 * 棚ごと並べ替えられるようにする層。
 *
 * **1つの DndContext が段と参考書の両方を見る。** 別々にすると、段をまたいで
 * 本を動かすときに「どの棚へ落ちたか」が分からなくなる。
 *
 * 握りは `touch-action: none` なので、いったん掴んだら方向の制限は無い（9章）。
 * 縦にも横にも動かせるので、段をまたぐ移動もドラッグでできる。
 *
 * dnd-kit は初回表示に不要なので、呼び出し側で遅延読み込みしている（10章）。
 */
export function SortableRoadmap({
  stages,
  books,
  onMoveItem,
  onReorderStages,
  ...handlers
}: RoadmapListProps) {
  const [active, setActive] = useState<{ type: "stage" | "item"; id: string } | null>(null);

  // センサーは1つだけ登録する。2つ登録すると後勝ちで上書きされて無言で壊れる（9章）
  const sensors = useSensors(
    useSensor(RoadmapSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const onDragStart = ({ active: a }: DragStartEvent) => {
    const type = (a.data.current?.type as "stage" | "item" | undefined) ?? "item";
    setActive({ type, id: String(a.id) });
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;

    const activeType = a.data.current?.type as "stage" | "item" | undefined;
    const overId = String(over.id);

    if (activeType === "stage") {
      // 段の上に落ちたときだけ動かす。本の上に落ちても段は動かさない
      const overType = over.data.current?.type;
      const targetStage =
        overType === "stage"
          ? overId
          : overId.startsWith(DROP_PREFIX)
            ? overId.slice(DROP_PREFIX.length)
            : (over.data.current?.stageId as string | undefined);
      if (targetStage && targetStage !== a.id) onReorderStages(String(a.id), targetStage);
      return;
    }

    // 空の棚に落ちた
    if (overId.startsWith(DROP_PREFIX)) {
      onMoveItem(String(a.id), overId.slice(DROP_PREFIX.length), null);
      return;
    }

    // 別の本の上に落ちた。その本の位置へ割り込む
    const toStageId = over.data.current?.stageId as string | undefined;
    if (!toStageId) return;
    const toIndex = stages
      .find((s) => s.id === toStageId)
      ?.items.findIndex((i) => i.id === overId);
    onMoveItem(String(a.id), toStageId, toIndex === undefined || toIndex < 0 ? null : toIndex);
  };

  const activeItem =
    active?.type === "item"
      ? stages.flatMap((s) => s.items).find((i) => i.id === active.id)
      : null;
  const activeBook = activeItem ? books[activeItem.bookId] : null;

  return (
    <DndContext
      sensors={sensors}
      /* 段をまたぐので、重なりではなく指の位置で判定する */
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragCancel={() => setActive(null)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {stages.map((stage, index) => (
          <SortableStage
            key={stage.id}
            stage={stage}
            index={index}
            books={books}
            {...handlers}
          />
        ))}
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {activeItem && activeBook ? (
          <BookSpine item={activeItem} book={activeBook} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableStage({
  stage,
  index,
  books,
  ...handlers
}: { stage: RoadmapStage; index: number; books: Record<string, Book> } & ShelfHandlers) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    data: { type: "stage" },
  });

  /** 空の棚にも落とせるようにする */
  const { setNodeRef: setDropRef } = useDroppable({
    id: `${DROP_PREFIX}${stage.id}`,
    data: { type: "stage-drop", stageId: stage.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : ""}
    >
      <Shelf
        stage={stage}
        index={index}
        beadProps={{ ...listeners, ...attributes } as HTMLAttributes<HTMLDivElement>}
        shelfDropRef={setDropRef}
        {...handlers}
      >
        <SortableContext
          items={stage.items.map((i) => i.id)}
          strategy={horizontalListSortingStrategy}
        >
          {stage.items.map((item) => {
            const book = books[item.bookId];
            if (!book) return null;
            return (
              <SortableBook
                key={item.id}
                stageId={stage.id}
                item={item}
                book={book}
                onOpen={handlers.onOpenItem}
              />
            );
          })}
        </SortableContext>
      </Shelf>
    </div>
  );
}

function SortableBook({
  stageId,
  item,
  book,
  onOpen,
}: {
  stageId: string;
  item: RoadmapStage["items"][number];
  book: Book;
  onOpen?: (itemId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "item", stageId },
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
