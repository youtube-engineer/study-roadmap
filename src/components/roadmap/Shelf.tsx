"use client";

import type { KeyboardEvent } from "react";

import { CheckIcon } from "@/components/ui/icons";
import { isStageDone } from "@/types/roadmap";
import type { Book, RoadmapStage } from "@/types/roadmap";

import { BookSpine } from "./BookSpine";

type Props = {
  stage: RoadmapStage;
  index: number;
  books: Record<string, Book>;
  /** 読み取り専用（共有ページ）では操作を出さない */
  readOnly?: boolean;
  onToggleStage?: (stageId: string) => void;
  onRenameStage?: (stageId: string, name: string) => void;
  onOpenItem?: (itemId: string) => void;
  onAddBook?: (stageId: string) => void;
  onOpenStageMenu?: (stageId: string) => void;
};

/**
 * 段ひとつ。左を紐と玉が通り、その右に棚が載る。
 *
 * **紐が段と段をつなぐ**ので、棚が並んだだけの画面にならない。
 * 経路は1本のままで、枝分かれではない（8章で取り下げたのはそちら）。
 */
export function Shelf({
  stage,
  index,
  books,
  readOnly = false,
  onToggleStage,
  onRenameStage,
  onOpenItem,
  onAddBook,
  onOpenStageMenu,
}: Props) {
  const done = isStageDone(stage);
  const doneCount = stage.items.filter((i) => i.isDone).length;

  const onNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    // 日本語入力の確定Enterを拾わない（14章）
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    e.currentTarget.blur();
  };

  return (
    <section className="relative pl-[46px]">
      <span className="absolute inset-y-0 left-[15px] flex w-[22px] justify-center">
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 w-[3px] rounded-sm bg-thread transition-opacity ${
            done ? "opacity-100" : "opacity-[0.28]"
          }`}
        />
        {/* 玉は24pxだが、当たり判定は44pxまで広げる */}
        <button
          type="button"
          disabled={readOnly || stage.items.length === 0}
          onClick={() => onToggleStage?.(stage.id)}
          aria-pressed={done}
          aria-label={done ? "この段を未終了に戻す" : "この段を終了にする"}
          className={`relative z-[2] mt-0.5 grid h-6 w-6 flex-none place-items-center self-start rounded-full border-[2.5px] border-thread font-mono text-[0.72rem] shadow-[0_0_0_4px_var(--raised)] after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] disabled:cursor-default ${
            done ? "bg-thread text-white" : "bg-raised text-thread"
          }`}
        >
          {done ? <CheckIcon size={12} /> : index + 1}
        </button>
      </span>

      <div className="flex min-h-7 items-baseline gap-2 pr-4">
        {readOnly ? (
          <span className={`text-[1rem] font-bold ${done ? "text-ink-soft" : ""}`}>
            {stage.name || "（名前なし）"}
          </span>
        ) : (
          <input
            defaultValue={stage.name}
            onBlur={(e) => onRenameStage?.(stage.id, e.currentTarget.value.trim())}
            onKeyDown={onNameKeyDown}
            placeholder="段の名前"
            aria-label="段の名前"
            className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[1rem] font-bold outline-none placeholder:font-normal placeholder:text-ink-faint ${
              done ? "text-ink-soft" : "text-ink"
            }`}
          />
        )}

        <span
          className={`ml-auto flex-none font-mono text-[0.72rem] ${
            done ? "text-thread" : "text-ink-faint"
          }`}
        >
          {stage.items.length === 0
            ? "まだ空"
            : done
              ? `${stage.items.length}冊 ぜんぶ終了`
              : `${stage.items.length}冊中 ${doneCount}冊`}
        </span>

        {!readOnly && (
          <button
            type="button"
            onClick={() => onOpenStageMenu?.(stage.id)}
            aria-label={`${stage.name || "この段"} の設定`}
            className="-mr-2 grid h-7 w-7 flex-none place-items-center rounded-full text-ink-faint hover:bg-sunk hover:text-ink-soft"
          >
            <span aria-hidden="true" className="text-[0.95rem] leading-none">
              ⋯
            </span>
          </button>
        )}
      </div>

      <div className="relative mt-0.5">
        {/* 横スクロールを通す。掴む操作は載せない（9章） */}
        <div className="shelf-books flex snap-x snap-proximity items-end gap-[11px] overflow-x-auto pr-4 pt-0.5">
          {stage.items.map((item) => {
            const book = books[item.bookId];
            if (!book) return null;
            return (
              <BookSpine
                key={item.id}
                item={item}
                book={book}
                onOpen={(id) => onOpenItem?.(id)}
              />
            );
          })}

          {!readOnly && (
            <button
              type="button"
              onClick={() => onAddBook?.(stage.id)}
              aria-label="この段に参考書を追加"
              className="mt-[17px] grid h-[101px] w-[74px] flex-none place-items-center rounded-[5px] border-[1.5px] border-dashed border-rule-strong text-[1.2rem] text-ink-faint hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
            >
              ＋
            </button>
          )}
        </div>

        {/* 見切れている本があることを示す */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 right-0 top-[18px] w-[34px] bg-gradient-to-r from-transparent to-raised"
        />
        <div className="shelf-board" />
      </div>
    </section>
  );
}
