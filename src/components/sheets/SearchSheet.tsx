"use client";

import { useEffect, useRef, useState } from "react";

import { BookCover } from "@/components/ui/BookCover";
import { SearchIcon } from "@/components/ui/icons";
import { hueFromTitle } from "@/lib/books/hue";
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
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  /** 手入力の欄を開いているか。開くまでは1行のボタンとして畳んでおく */
  const [manualOpen, setManualOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 開いた瞬間に入力を空へ戻す（レンダー中に前回値と比べる）
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setManualAuthor("");
      setManualTitle("");
      setManualOpen(false);
    }
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

  /**
   * 市販されていない教材を手で追加する。
   *
   * 検索を行き止まりにしない。塾のプリントや自作ノートも経路に置けるように
   * することで、実際の学習に即したルートが組める（画面設計 05）。
   * 表紙は無いので、書名から作った色帯で代替する。
   */
  const addManual = () => {
    const title = (manualOpen ? manualTitle : query).trim();
    if (!title) return;
    onPick({
      id: crypto.randomUUID(),
      isbn: null,
      source: "manual",
      title,
      author: manualAuthor.trim(),
      publishedYear: null,
      coverImageUrl: null,
      sourceUrl: null,
      hue: hueFromTitle(title),
    });
  };

  const nothingFound = status === "ok" && results.length === 0 && query.trim() !== "";

  return (
    <Sheet open={open} onClose={onClose} title="参考書をさがす">
      {!manualOpen && (
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
      )}

      {/*
        何も打っていないときは人気の参考書を出す。空の一覧だと打ち始めた瞬間に
        シートが伸びて入力欄が動くし、何を置けばいいのかの見当もつかない
      */}
      {!manualOpen && (
      <div className="px-4 pb-1 pt-2.5 text-[0.72rem] text-ink-faint">
        {query.trim() === ""
          ? "いま売れている参考書"
          : status === "loading"
            ? "さがしています…"
            : "検索結果"}
      </div>
      )}

      {/*
        高さを固定する。結果の件数でシートが伸び縮みすると、入力欄が動いて
        打ちにくい
      */}
      {/*
        **手で追加しているあいだは一覧を出さない。** 自分で名前を打っている横に
        別の本が並んでいると、何をしているのか分からなくなる。
      */}
      {!manualOpen && (
      <div className="h-[44vh] overflow-y-auto px-2 pb-2">
        {status === "timeout" ? (
          <Notice
            title="検索が時間内に終わりませんでした"
            detail="通信の状態を確かめて、もう一度お試しください。"
          />
        ) : status === "error" ? (
          <Notice title="検索できませんでした" detail="しばらくしてからもう一度お試しください。" />
        ) : (
          <>
            {results.map((book) => (
              <ResultRow
                key={book.id}
                book={book}
                added={present.has(book.id)}
                onPick={() => onPick(book)}
              />
            ))}

            {nothingFound && (
              <p className="px-3 pb-1 pt-4 text-[0.84rem] text-ink-faint">
                見つかりませんでした。
              </p>
            )}

          </>
        )}
      </div>
      )}

      {/*
        **手で追加する道は常に開けておく。**

        一覧の中ではなくここに置くのは、検索する前（売れ筋が20件並んでいる状態）
        でもスクロールせずに見えるようにするため。結果がちょうど0件のときだけ
        フォームに切り替わる形だと、無関係な結果が1件でも返ると手詰まりになるし、
        切り替わると打ち直したい検索結果が見えなくなる（8章「検索を行き止まりに
        しない」）。
      */}
      <div className={manualOpen ? "px-4 pb-4 pt-1" : "border-t border-rule px-3 py-2.5"}>
        {manualOpen ? (
          <div className="flex flex-col gap-3.5">
            <p className="text-[0.82rem] leading-relaxed text-ink-faint">
              市販されていない教材も、名前を付けてロードマップに置けます。
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-title" className="text-[0.76rem] font-bold text-ink-soft">
                教材名
              </label>
              <input
                id="manual-title"
                autoFocus
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="例：塾のオリジナルプリント"
                className="rounded-[9px] border border-rule bg-sunk px-3 py-2 text-[0.88rem] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-author" className="text-[0.76rem] font-bold text-ink-soft">
                出版社・作った人（任意）
              </label>
              <input
                id="manual-author"
                value={manualAuthor}
                onChange={(e) => setManualAuthor(e.target.value)}
                placeholder="〇〇ゼミ"
                className="rounded-[9px] border border-rule bg-sunk px-3 py-2 text-[0.88rem] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="rounded-[10px] border border-rule-strong px-4 py-2.5 text-[0.84rem] text-ink-soft"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={addManual}
                disabled={manualTitle.trim() === ""}
                className="flex-1 rounded-[10px] bg-accent px-4 py-2.5 text-[0.88rem] font-bold text-white disabled:opacity-40 enabled:hover:bg-accent-strong"
              >
                この教材を追加
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setManualTitle(query.trim());
              setManualOpen(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-rule-strong px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft"
          >
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent-soft text-[1.05rem] text-accent-strong">
              ＋
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.85rem] font-bold text-ink">
                {query.trim() === ""
                  ? "リストに無い教材を手で追加"
                  : `「${query.trim()}」を手で追加`}
              </span>
              <span className="block text-[0.73rem] text-ink-faint">
                塾のプリントや自作ノートも置けます
              </span>
            </span>
          </button>
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

/** 「旺文社・2024・楽天ブックス」。どこから来た情報かを隠さない */
function sourceLabel(book: Book): string {
  switch (book.source) {
    case "rakuten":
      return "楽天ブックス";
    case "openbd":
      return "openBD";
    case "manual":
      return "手入力";
    default:
      return "";
  }
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
  const label = sourceLabel(book);
  const meta = [book.author, book.publishedYear].filter(Boolean).join("・");

  return (
    // 行をタップすればそのまま末尾に入る（画面設計 04）。
    // 出典のリンクだけは押しても追加されないよう、伝播を止める
    <div
      role="button"
      tabIndex={added ? undefined : 0}
      aria-disabled={added}
      onClick={added ? undefined : onPick}
      onKeyDown={
        added
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick();
              }
            }
      }
      className={`flex items-center gap-2.5 border-b border-rule px-3 py-2.5 text-left last:border-b-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
        added ? "opacity-50" : "cursor-pointer hover:bg-sunk"
      }`}
    >
      <BookCover book={book} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.86rem]">{book.title}</span>
        <span className="block font-mono text-[0.66rem] text-ink-faint">
          {meta}
          {meta && label ? "・" : ""}
          {/*
            楽天ウェブサービス規約 第8条4項。ウェブサービスを使っているこの画面には
            楽天サイトへのリンクを置き、楽天以外へのリンクは置かない
          */}
          {book.sourceUrl ? (
            <a
              href={book.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline underline-offset-2 hover:text-ink-soft"
            >
              {label}
            </a>
          ) : (
            label
          )}
        </span>
      </span>

      <span
        className={`flex-none rounded-full px-2 py-[0.16em] text-[0.71rem] ${
          added ? "bg-sunk text-ink-faint" : "bg-accent-soft text-accent-strong"
        }`}
      >
        {added ? "追加済み" : "追加"}
      </span>
    </div>
  );
}
