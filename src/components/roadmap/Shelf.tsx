"use client";

import type { HTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";

import { CheckIcon } from "@/components/ui/icons";
import { isStageDone } from "@/types/roadmap";
import type { RoadmapStage } from "@/types/roadmap";

/** 棚が外へ渡す操作。並べ替えの層をまたいで運ぶので型をまとめておく */
export type ShelfHandlers = {
  onToggleStage?: (stageId: string) => void;
  onRenameStage?: (stageId: string, name: string) => void;
  onOpenItem?: (itemId: string) => void;
  onAddBook?: (stageId: string) => void;
  onOpenStageMenu?: (stageId: string) => void;
};

type Props = ShelfHandlers & {
  stage: RoadmapStage;
  index: number;
  /** 読み取り専用（共有ページ）では操作を出さない */
  readOnly?: boolean;
  /** 段の玉に付けるドラッグの手。段はここを掴んで動かす */
  beadProps?: HTMLAttributes<HTMLDivElement>;
  /** 空の棚にも本を落とせるようにするための参照 */
  shelfDropRef?: Ref<HTMLDivElement>;
  /** 棚に並ぶ本。並べ替えの有無で中身が変わる */
  children: ReactNode;
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
  readOnly = false,
  beadProps,
  shelfDropRef,
  children,
  onToggleStage,
  onRenameStage,
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

  const toggle = () => {
    if (readOnly || stage.items.length === 0) return;
    onToggleStage?.(stage.id);
  };

  return (
    <section className="relative pl-[46px] md:pl-[58px]">
      <span className="absolute inset-y-0 left-[15px] flex w-[22px] justify-center md:left-[22px]">
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 w-[3px] rounded-sm bg-thread transition-opacity ${
            done ? "opacity-100" : "opacity-[0.28]"
          }`}
        />
        {/*
          玉は2つの役割を持つ。押せば段の終了を切り替え、つまめば段を動かせる。
          **`<button>` にしない。** センサーはボタンの上でドラッグを始めない作り
          なので、ボタンにすると掴めなくなる（9章）。
          当たり判定は 24px の玉に対して 44px まで広げる。
        */}
        <div
          {...beadProps}
          role={readOnly ? undefined : "button"}
          tabIndex={readOnly ? undefined : 0}
          aria-pressed={readOnly ? undefined : done}
          aria-label={
            readOnly ? undefined : done ? "この段を未終了に戻す" : "この段を終了にする"
          }
          onClick={readOnly ? undefined : toggle}
          onKeyDown={
            readOnly
              ? undefined
              : (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    toggle();
                    return;
                  }
                  beadProps?.onKeyDown?.(e);
                }
          }
          className={`relative z-[2] mt-0.5 grid h-6 w-6 flex-none touch-none place-items-center self-start rounded-full border-[2.5px] border-thread font-mono text-[0.72rem] shadow-[0_0_0_4px_var(--raised)] after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent ${
            done ? "bg-thread text-white" : "bg-raised text-thread"
          } ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}`}
        >
          {done ? <CheckIcon size={12} /> : index + 1}
        </div>
      </span>

      <div className="flex min-h-7 items-baseline gap-2 pr-4 md:pr-6">
        {readOnly ? (
          <span className={`text-[1.05rem] font-bold ${done ? "text-ink-soft" : ""}`}>
            {stage.name || "（名前なし）"}
          </span>
        ) : (
          <input
            defaultValue={stage.name}
            onBlur={(e) => onRenameStage?.(stage.id, e.currentTarget.value.trim())}
            onKeyDown={onNameKeyDown}
            placeholder="段の名前"
            aria-label="段の名前"
            className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[1.05rem] font-bold tracking-[-0.01em] outline-none placeholder:font-medium placeholder:text-ink-faint ${
              done ? "text-ink-soft" : "text-ink"
            }`}
          />
        )}

        <span
          className={`ml-auto flex-none text-[0.78rem] font-bold tabular-nums ${
            done ? "text-thread" : "text-ink-faint"
          }`}
        >
          {stage.items.length === 0
            ? "まだ空"
            : done
              ? "すべて終了 ✓"
              : `${doneCount}/${stage.items.length}`}
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
        {/* 棚の奥板。本の後ろに板があるように見せる */}
        <span
          aria-hidden="true"
          className="shelf-back pointer-events-none absolute inset-x-0 bottom-[14px] top-[11px]"
        />

        {/* 横スクロールを通す。掴む操作は本の握りだけが持つ（9章） */}
        <div
          ref={shelfDropRef}
          /*
            **吸着（scroll-snap）は使わない。** 本の左端を棚の左端に合わせに
            いくので、先頭の余白がスクロールで食われて本が側板に食い込んで見える。
            棚では吸着の利点より害が大きい。

            余白も padding ではなく**空要素で取る**（下）。横スクロールする
            flex の中では、左右どちらの padding もスクロールした位置で潰れる。
          */
          className="shelf-books shelf-height relative flex items-end gap-[13px] overflow-x-auto pb-2 pt-0.5 md:gap-[17px] md:pb-2.5"
        >
          <span aria-hidden="true" className="w-4 flex-none md:w-5" />

          {children}

          {!readOnly && (
            <button
              type="button"
              onClick={() => onAddBook?.(stage.id)}
              aria-label="この段に参考書を追加"
              /* 木の上なので、地の色ではなく濃淡で見せる */
              className="book-size mt-[17px] grid flex-none place-items-center rounded-[5px] border-2 border-dashed border-black/25 bg-black/[0.04] text-[1.4rem] text-black/45 transition-colors hover:border-black/45 hover:bg-black/10 hover:text-black/70"
            >
              ＋
            </button>
          )}

          {/*
            **末尾の余白は空要素で取る。**
            横スクロールする flex の中では `padding-right` がスクロールしきった
            位置で潰れる。本が増えると最後の1冊が側板に食い込んで見えていた。
          */}
          <span aria-hidden="true" className="w-4 flex-none md:w-5" />
        </div>

        {/*
          左右の側板。**本はこの下へ潜る。**
          スクロールすると本が棚の端に食い込んで見えるので、枠の影を重ねて
          「奥へ滑り込んでいる」ように読ませる。

          **幅は棚の内側の余白ちょうどにすること。** 広くすると、スクロールして
          いない状態でも端の本にかぶって暗くなる。
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[14px] left-0 top-[11px] w-4 bg-gradient-to-r from-black/40 to-transparent md:w-5"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[14px] right-0 top-[11px] w-4 bg-gradient-to-l from-black/40 to-transparent md:w-5"
        />
        {/* 本が棚板に触れているところの影 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-[14px] h-4 bg-gradient-to-t from-black/35 to-transparent"
        />
        <div className="shelf-board" />

        {/*
          どこまで進んだかを棚板の上に線で出す。玉と紐だけだと段の中の進み具合が
          分からない。臙脂は経路と進捗（8章）なので役割も混ざらない
        */}
        {stage.items.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-[14px] h-[3px] overflow-hidden rounded-full"
          >
            <span
              className="block h-full rounded-full bg-thread transition-[width] duration-300"
              style={{ width: `${(doneCount / stage.items.length) * 100}%` }}
            />
          </span>
        )}
      </div>
    </section>
  );
}
