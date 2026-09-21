"use client";

import { useState } from "react";

import { BookCover } from "@/components/ui/BookCover";
import { CheckIcon } from "@/components/ui/icons";
import { ROUNDS_MAX, ROUNDS_MIN } from "@/types/roadmap";
import type { Book, RoadmapItem } from "@/types/roadmap";

import { Sheet } from "./Sheet";

type Props = {
  item: RoadmapItem | null;
  book: Book | null;
  onClose: () => void;
  onPatch: (itemId: string, patch: Partial<RoadmapItem>) => void;
  onToggleDone: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

/**
 * 参考書ごとの設定。**削除はここに置き、カード上には置かない。**
 * 破壊的操作の誤爆を防ぐため（CLAUDE.md 8章）。
 */
export function DetailSheet({
  item,
  book,
  onClose,
  onPatch,
  onToggleDone,
  onRemove,
}: Props) {
  const [note, setNote] = useState(item?.note ?? "");
  const [rounds, setRounds] = useState<number | null>(item?.roundsTarget ?? null);

  // 別の参考書が開かれたら編集中の値を差し替える。
  // レンダー中に前回値と比べて直すのが React の勧めるやり方で、
  // useEffect で同期すると余計なレンダーが1回挟まる
  const [syncedId, setSyncedId] = useState(item?.id ?? null);
  if (item && item.id !== syncedId) {
    setSyncedId(item.id);
    setNote(item.note);
    setRounds(item.roundsTarget);
  }

  const commit = () => {
    if (item) onPatch(item.id, { note, roundsTarget: rounds });
    onClose();
  };

  /**
   * 買える場所。
   *
   * **保存済みの出典が無くても ISBN から引き直せる。** 出典を保存する前に
   * 追加した本や、提供元が URL を返さなかった本でも買える場所を出したい。
   * ISBN は国際標準の識別子なので、これだけあれば辿れる（CLAUDE.md 6章）。
   */
  const buyUrl =
    book?.sourceUrl ||
    (book?.isbn ? `https://books.rakuten.co.jp/search?sitem=${book.isbn}` : null);

  const setRoundsClamped = (value: number | null) => {
    setRounds(value === null ? null : Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, value)));
  };

  return (
    <Sheet open={Boolean(item)} onClose={commit} title="参考書の設定">
      {item && book && (
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-5 pt-1.5">
          {/* どの本を触っているかが表紙で分かるように、ここは大きく見せる */}
          <div className="flex items-start gap-3.5">
            <BookCover book={book} size="lg" />
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-[1.02rem] font-bold leading-[1.5]">{book.title}</div>
              <div className="mt-0.5 text-[0.78rem] text-ink-faint">{book.author}</div>
              {book.publishedYear && (
                <div className="mt-0.5 font-mono text-[0.7rem] text-ink-faint">
                  {book.publishedYear}
                </div>
              )}
            </div>
          </div>

          {/*
            買える場所。**カードではなくここに置く。** カードは紐と玉で構造を
            担っていて、ボタンを足すと経路が買い物リストに戻る（CLAUDE.md 8章）。

            文言は「見る」にとどめる。購入やクリックを呼びかけるのは
            楽天ウェブサービス規約 第10条1項(1) の禁止事項（7章）。
            手入力した教材には出典が無いので出ない。
          */}
          {buyUrl && (
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent-soft px-4 py-3 text-[0.9rem] font-bold text-accent-strong transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              楽天ブックスで見る
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          )}

          <button
            type="button"
            onClick={() => {
              onToggleDone(item.id);
              // 終えたら本は棚の右端へ動く。シートを開いたままだと
              // 動いたことに気づけないので、閉じて棚を見せる
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[0.88rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              item.isDone
                ? "border-thread/45 bg-thread-soft font-medium text-thread"
                : "border-rule bg-sunk text-ink-soft"
            }`}
          >
            <span
              className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 text-white ${
                item.isDone ? "border-thread bg-thread" : "border-rule-strong"
              }`}
            >
              {item.isDone ? <CheckIcon size={14} /> : null}
            </span>
            {item.isDone ? "この参考書は終了した" : "終了にする"}
          </button>

          <div className="flex flex-col gap-2">
            <span className="text-[0.8rem] font-bold text-ink-soft">周回の目標</span>
            <div className="flex items-center gap-2">
              <StepButton
                label="減らす"
                onClick={() => setRoundsClamped(rounds ? rounds - 1 : null)}
                disabled={!rounds}
              >
                −
              </StepButton>
              <span className="min-w-[4.5em] text-center font-mono text-[0.86rem]">
                {rounds ? `${rounds}周` : "決めない"}
              </span>
              <StepButton
                label="増やす"
                onClick={() => setRoundsClamped(rounds ? rounds + 1 : 1)}
              >
                ＋
              </StepButton>
              {rounds ? (
                <button
                  type="button"
                  onClick={() => setRoundsClamped(null)}
                  className="ml-auto rounded-lg border border-rule bg-sunk px-2.5 py-1 text-[0.72rem] text-ink-soft"
                >
                  目標を外す
                </button>
              ) : null}
            </div>
            <p className="text-[0.72rem] text-ink-faint">
              最初に決めるだけの目標。今何周目かは記録しない。
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="item-note" className="text-[0.8rem] font-bold text-ink-soft">
              この本を使うときのメモ
            </label>
            <textarea
              id="item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="例：知らない単語だけ付箋を貼って、2周目からは付箋の分だけやる"
              className="w-full resize-y rounded-[10px] border border-rule bg-sunk px-3 py-2.5 text-[0.88rem] leading-[1.7] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
            />
            <p className="text-[0.72rem] text-ink-faint">
              共有したとき、このメモが相手に読まれる部分になる。
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onRemove(item.id);
                onClose();
              }}
              className="rounded-[9px] border border-rule-strong px-3 py-2 text-[0.82rem] text-ink-soft hover:border-thread hover:text-thread"
            >
              ロードマップから外す
            </button>
            <button
              type="button"
              onClick={commit}
              className="ml-auto rounded-[10px] bg-accent px-5 py-2.5 text-[0.88rem] font-bold text-white hover:bg-accent-strong"
            >
              保存して閉じる
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 flex-none rounded-lg border border-rule bg-sunk text-base leading-none text-ink-soft disabled:cursor-default disabled:opacity-40 enabled:hover:border-accent enabled:hover:text-accent-strong"
    >
      {children}
    </button>
  );
}
