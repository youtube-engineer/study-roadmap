"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  /**
   * **共有ページでは進捗を出さない。**
   * 他人がどこまで終えたかは読む側に関係が無く、計画として読ませたい
   * （CLAUDE.md 8章）。玉は数字のまま、棚板の線も出さない。
   */
  /**
   * ★ **棚の横移動は矢印ボタンだけで行う。**
   *
   * 指で横になぞる操作を棚から取り上げると、**フリックは参考書を動かすため
   * だけのものになり、掴む／滑らせるの取り合いが起きなくなる**（9章の
   * touch-action の問題そのものが消える）。
   *
   * ホイールやトラックパッドは `touch-action` の対象外なので、
   * パソコンではこれまでどおり横に流せる。
   */
  /**
   * 棚（横に流れる帯）は `shelfDropRef`（dnd-kit のもの）が付いているので、
   * **そこへ自分の ref を重ねない。** 外側から引いて使う。
   */
  const frame = useRef<HTMLDivElement | null>(null);
  const scrollerOf = () => frame.current?.querySelector<HTMLDivElement>(".shelf-books") ?? null;
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = frame.current?.querySelector<HTMLDivElement>(".shelf-books");
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = frame.current?.querySelector<HTMLDivElement>(".shelf-books");
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });

    /**
     * **表紙が読み込まれた時点でも測り直す。**
     * 最初の描画では画像がまだ無く、棚の中身は実際より狭い。
     * そこで一度しか測らないと、**本がはみ出しているのに矢印が出ない。**
     */
    el.addEventListener("load", measure, true);
    window.addEventListener("resize", measure);

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);

    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("load", measure, true);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [measure, stage.items.length]);

  /**
   * 見えている幅の8割ぶん送る。1冊ずつだと本が多いときに終わらない。
   *
   * ⚠ **`behavior: "smooth"` に頼らない。** 環境によっては無視されて
   * まったく動かない（実測でそうなった）。押しても何も起きないのが
   * 一番困るので、**自分で動かす。**
   */
  const slide = (direction: -1 | 1) => {
    const el = scrollerOf();
    if (!el) return;

    const max = el.scrollWidth - el.clientWidth;
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(max, from + direction * el.clientWidth * 0.8));
    if (to === from) return;

    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 220);
      // ease-out。最後にすっと止まる
      el.scrollLeft = from + (to - from) * (1 - (1 - t) ** 3);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const done = !readOnly && isStageDone(stage);
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
          /*
            **名前が無いなら何も出さない。** 「（名前なし）」と書くと、
            名前を付けなかったことの方が目立ってしまう。場所だけ空けておく。
          */
          <span className="text-[1.05rem] font-bold">{stage.name}</span>
        ) : (
          <input
            defaultValue={stage.name}
            onBlur={(e) => onRenameStage?.(stage.id, e.currentTarget.value.trim())}
            onKeyDown={onNameKeyDown}
            /* 見出しなので短く。OGP画像でも14字で切っている */
            maxLength={20}
            placeholder="段の名前"
            aria-label="段の名前"
            className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[1.05rem] font-bold tracking-[-0.01em] outline-none placeholder:font-medium placeholder:text-ink-faint ${
              done ? "text-ink-soft" : "text-ink-title"
            }`}
          />
        )}

        <span
          className={`ml-auto flex-none text-[0.78rem] font-bold tabular-nums ${
            done ? "text-thread" : "text-ink-faint"
          }`}
        >
          {readOnly
            ? stage.items.length > 0
              ? `${stage.items.length}冊`
              : ""
            : stage.items.length === 0
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

      <div ref={frame} className="relative mt-0.5">
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

        {/*
          横に送る矢印。**端に着いたら出さない**（押せないボタンを置かない）。
          棚の中に置くので、木の上でも読めるよう白い丸に濃い字を載せる。
        */}
        {edge.left && (
          <button
            type="button"
            onClick={() => slide(-1)}
            aria-label="左へ送る"
            className="absolute left-1.5 top-1/2 z-[3] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition hover:bg-white active:scale-95"
          >
            <ArrowIcon direction="left" />
          </button>
        )}
        {edge.right && (
          <button
            type="button"
            onClick={() => slide(1)}
            aria-label="右へ送る"
            className="absolute right-1.5 top-1/2 z-[3] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition hover:bg-white active:scale-95"
          >
            <ArrowIcon direction="right" />
          </button>
        )}
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
        {!readOnly && stage.items.length > 0 && (
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

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
