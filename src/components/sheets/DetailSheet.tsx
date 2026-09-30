"use client";

import { useState } from "react";

import { BookCover } from "@/components/ui/BookCover";
import { CheckIcon } from "@/components/ui/icons";
import type { Book, RoadmapItem } from "@/types/roadmap";

import { Sheet } from "./Sheet";

type Props = {
  item: RoadmapItem | null;
  book: Book | null;
  onClose: () => void;
  onPatch?: (itemId: string, patch: Partial<RoadmapItem>) => void;
  onToggleDone?: (itemId: string) => void;
  onRemove?: (itemId: string) => void;
  /**
   * 共有ページ。**同じ見た目のまま、触れなくする。**
   * 別のシートを用意すると、同じ情報が2通りの並びで出ることになる。
   */
  readOnly?: boolean;
};

/**
 * 参考書ごとの設定。**削除はここに置き、カード上には置かない。**
 * 破壊的操作の誤爆を防ぐため（CLAUDE.md 8章）。
 *
 * 共有ページでは `readOnly` で開く。並びも余白も変えずに、入力欄を本文に、
 * 操作を出さないだけにする。他人の終了状態も出さない（8章）。
 */
export function DetailSheet({
  item,
  book,
  onClose,
  onPatch,
  onToggleDone,
  onRemove,
  readOnly = false,
}: Props) {
  const [note, setNote] = useState(item?.note ?? "");
  /**
   * **周回の目標は画面から外した。** 「何周やるか」を最初に決めさせても、
   * 実際に使うのは数字の記録ではなく順番とメモだった。
   * `rounds_target` のカラムと型は残してある（tags と同じ扱い）。
   */

  // 別の参考書が開かれたら編集中の値を差し替える。
  // レンダー中に前回値と比べて直すのが React の勧めるやり方で、
  // useEffect で同期すると余計なレンダーが1回挟まる
  const [syncedId, setSyncedId] = useState(item?.id ?? null);
  if (item && item.id !== syncedId) {
    setSyncedId(item.id);
    setNote(item.note);
  }

  /**
   * 閉じるときに書く。**「保存」ボタンは置かない。**
   *
   * シートは上の×でも、外側を押しても、Escでも閉じられて、
   * **どれを通ってもここを通る。** それでも保存されるのに保存ボタンを
   * 並べると、「押さないと消えるのか」と考えさせるだけになる。
   * 操作のたびに即書くのがこのアプリの作り（CLAUDE.md 5章）なので、
   * ここだけ確定の手数を増やさない。
   */
  const commit = () => {
    if (item && !readOnly) onPatch?.(item.id, { note });
    onClose();
  };

  /**
   * 買える場所。**どの本にも出す。** 出たり出なかったりすると、
   * 買えない本があるのか壊れているのかが読む側に分からない。
   *
   * 3段構えにする。上から順に確かさが落ちるだけで、行き先は必ず楽天。
   *
   *  1. 保存してある出典（提供元が返した商品ページ）
   *  2. **ISBN で引き直す。** 出典を保存する前に追加した本や、提供元が
   *     URL を返さなかった本がこれに当たる。ISBN は国際標準の識別子なので、
   *     これだけあれば辿れる（CLAUDE.md 6章）。実データでは楽天由来の本の
   *     大半がここで拾われる
   *  3. 書名で探す。手入力した教材には出典もISBNも無いため
   *
   * `??` ではなく `||` にしてあるのは、**「無い」が空文字で来るから**（14章）。
   *
   * 文言は「見る」にとどめる。購入やクリックを呼びかけるのは
   * 楽天ウェブサービス規約 第10条1項(1) の禁止事項（7章）。
   */
  const search = (term: string) =>
    `https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(term)}`;

  const buyUrl =
    book?.sourceUrl?.trim() ||
    (book?.isbn?.trim() ? search(book.isbn.trim()) : null) ||
    (book?.title?.trim() ? search(book.title.trim()) : null);

  return (
    <Sheet open={Boolean(item)} onClose={commit} title={readOnly ? "参考書" : "参考書の設定"}>
      {item && book && (
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-5 pt-1.5">
          {/* どの本を触っているかが表紙で分かるように、ここは大きく見せる */}
          <div className="flex items-start gap-3.5">
            <BookCover book={book} size="lg" />
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-[1.02rem] font-bold leading-[1.5] text-ink-title">
                {book.title}
              </div>
              <div className="mt-0.5 text-[0.78rem] text-ink-faint">{book.author}</div>
              {book.publishedYear && (
                <div className="mt-0.5 font-mono text-[0.7rem] text-ink-faint">
                  {book.publishedYear}
                </div>
              )}
            </div>
          </div>

          {!readOnly && (
          <button
            type="button"
            onClick={() => {
              onToggleDone?.(item.id);
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
          )}

          {readOnly ? (
            <div className="flex flex-col gap-2">
              <span className="text-[0.8rem] font-bold text-ink-soft">
                この本を使うときのメモ
              </span>
              {item.note ? (
                <p className="whitespace-pre-wrap rounded-[10px] bg-sunk px-3 py-2.5 text-[0.88rem] leading-[1.8] text-ink-soft">
                  {item.note}
                </p>
              ) : (
                <p className="text-[0.8rem] text-ink-faint">メモはありません。</p>
              )}
            </div>
          ) : (
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
          )}

          {/*
            買える場所。**カードではなくここに置く。** カードは紐と玉で構造を
            担っていて、ボタンを足すと経路が買い物リストに戻る（CLAUDE.md 8章）。

            **メモより下に置く。** 開いてすぐ読みたいのは自分で書いたメモで、
            買う場所はその後でいい。
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

          {readOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-[10px] bg-accent px-5 py-2.5 text-[0.88rem] font-bold text-accent-ink hover:bg-accent-strong"
            >
              閉じる
            </button>
          ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onRemove?.(item.id);
                onClose();
              }}
              className="rounded-[9px] border border-rule-strong px-3 py-2 text-[0.82rem] text-ink-soft hover:border-thread hover:text-thread"
            >
              ロードマップから外す
            </button>
          </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
