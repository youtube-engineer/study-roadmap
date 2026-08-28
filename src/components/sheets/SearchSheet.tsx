"use client";

import { useEffect, useRef, useState } from "react";

import { BookCover } from "@/components/ui/BookCover";
import { SearchIcon } from "@/components/ui/icons";
import type { Book } from "@/types/roadmap";

import { RakutenCredit } from "./RakutenCredit";
import { Sheet } from "./Sheet";

type Status = "idle" | "loading" | "ok" | "timeout" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (book: Book) => void;
  /** すでにルートに入っている bookId */
  present: ReadonlySet<string>;
};

const DEBOUNCE_MS = 250;

export function SearchSheet({ open, onClose, onPick, present }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  // 開いた瞬間に入力を空へ戻す（レンダー中に前回値と比べる）
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  // フォーカスはReactの外側の操作なので副作用でよい。
  // シートのスライドが終わってから当てる
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.status === 504) {
          setStatus("timeout");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { books: Book[] };
        setResults(data.books);
        setStatus("ok");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [open, query]);

  return (
    <Sheet open={open} onClose={onClose} title="参考書をさがす">
      <div className="mx-4 flex items-center gap-2 rounded-[10px] border border-rule bg-sunk px-2.5 py-2 focus-within:border-accent">
        <SearchIcon className="flex-none text-ink-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="書名で探す"
          className="min-w-0 flex-1 border-0 bg-transparent text-[0.92rem] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="mt-1.5 overflow-y-auto px-2 pb-4">
        {status === "timeout" ? (
          <Notice
            title="検索が時間内に終わりませんでした"
            detail="通信の状態を確かめて、もう一度お試しください。"
          />
        ) : status === "error" ? (
          <Notice
            title="検索できませんでした"
            detail="しばらくしてからもう一度お試しください。"
          />
        ) : results.length === 0 && status === "ok" ? (
          <Notice title="見つかりませんでした" detail="手で入力して追加することもできます" />
        ) : (
          results.map((book) => (
            <ResultRow
              key={book.id}
              book={book}
              added={present.has(book.id)}
              onPick={() => onPick(book)}
            />
          ))
        )}
      </div>

      {/* 楽天ウェブサービスのクレジット表記（必須） */}
      <div className="flex justify-center border-t border-rule px-4 py-2.5">
        <RakutenCredit />
      </div>
    </Sheet>
  );
}

function Notice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-7 text-center text-[0.86rem] text-ink-faint">
      <span>{title}</span>
      <span className="text-[0.76rem]">{detail}</span>
    </div>
  );
}

function ResultRow({
  book,
  added,
  onPick,
}: {
  book: Book;
  added: boolean;
  onPick: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-rule px-3 py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        disabled={added}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default disabled:opacity-50"
      >
        <BookCover book={book} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.86rem]">{book.title}</span>
          <span className="block text-[0.71rem] text-ink-faint">
            {[book.author, book.publishedYear].filter(Boolean).join("・")}
          </span>
        </span>
        <span
          className={`flex-none rounded-full px-2 py-[0.16em] text-[0.71rem] ${
            added ? "bg-sunk text-ink-faint" : "bg-accent-soft text-accent-strong"
          }`}
        >
          {added ? "追加済み" : "追加"}
        </span>
      </button>
      {/* 楽天ウェブサービス規約 第8条4項: この画面には楽天サイトへのリンクを置き、
          楽天以外へのリンクは置かない */}
      {book.sourceUrl && (
        <a
          href={book.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none text-[0.68rem] text-ink-faint underline underline-offset-2 hover:text-ink-soft"
        >
          楽天ブックス
        </a>
      )}
    </div>
  );
}
