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

  /**
   * ★ **選んだものを溜めて、最後にまとめて入れる。**
   *
   * 1冊ごとに即入れる形だと、押した瞬間に確定するので**選び直せない。**
   * 「rules」で引いて 1・2・3 を取りたい、という場面がそもそも普通なのに、
   * 1冊目で確定すると残りを入れるのに検索からやり直すことになっていた。
   *
   * 押す＝選ぶ、にして、下の帯で一度に入れる。選び直しは押し直すだけ。
   */
  const [picked, setPicked] = useState<Book[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // 開いた瞬間に入力と選択を空へ戻す（レンダー中に前回値と比べる）
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setManualAuthor("");
      setManualTitle("");
      setManualOpen(false);
      setPicked([]);
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
    // 手入力は1件で終わる。選んで溜める検索と違って、入れたら閉じてよい
    onClose();
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
          className="min-w-0 flex-1 border-0 bg-transparent zoom-safe text-[0.92rem] text-ink outline-none placeholder:text-ink-faint"
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
      <div className="h-[52vh] overflow-y-auto px-2 pb-2">
        {status === "loading" ? (
          /*
            **さがしているあいだはぐるぐるを出す。** 見出しの文字だけだと、
            前の結果が残ったままなので動いているのか止まったのか分からない。
          */
          <div className="flex items-center justify-center gap-2.5 py-16 text-ink-faint">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-rule-strong border-t-thread"
            />
            <span className="text-[0.82rem]">さがしています…</span>
          </div>
        ) : status === "timeout" ? (
          <Notice
            title="検索が時間内に終わりませんでした"
            detail="通信の状態を確かめて、もう一度お試しください。"
          />
        ) : status === "error" ? (
          <Notice title="検索できませんでした" detail="しばらくしてからもう一度お試しください。" />
        ) : (
          <>
            {/*
              ★ **2カラムで表紙を主役にする。**

              参考書は書名より先に「あの黄色い本」で憶えていることが多い。
              1行ずつの一覧だと表紙が小さく、**絵で選べないから書名を読む**ことになり、
              似た書名が並ぶ検索では疲れる。棚と同じで、まず絵で選ばせる。
            */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-1 pt-1">
              {results.map((book) => (
                <ResultCard
                  key={book.id}
                  book={book}
                  added={present.has(book.id)}
                  picked={picked.some((p) => p.id === book.id)}
                  query={query}
                  onToggle={() =>
                    setPicked((prev) =>
                      prev.some((p) => p.id === book.id)
                        ? prev.filter((p) => p.id !== book.id)
                        : [...prev, book],
                    )
                  }
                />
              ))}
            </div>

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
      {/*
        ★ **選んだぶんをまとめて入れる帯。**

        選んでいるあいだだけ出す。0冊のときに押せないボタンを置いておくより、
        **選べば出る**方が「選ぶ → 入れる」という順番がそのまま読める。
        入れたらシートを閉じる——ここで作業は終わっているので、
        閉じないと棚が見えず、何冊入ったのか確かめられない。
      */}
      {!manualOpen && picked.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-rule px-3 py-2.5">
          {/*
            ★ **選んだものを並べて見せる。** 数だけだと、**別の語で検索し直した
            瞬間に中身が見えなくなる。** 何を選んだか憶えていられるのはせいぜい
            2〜3冊で、それ以上はカゴの意味が無い。
            押すと外れる——選び直すのに検索し直さなくていい。
          */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {picked.map((book) => (
              <button
                key={book.id}
                type="button"
                title={`${book.title} を外す`}
                aria-label={`${book.title} を外す`}
                onClick={() => setPicked((prev) => prev.filter((p) => p.id !== book.id))}
                className="group relative flex-none"
              >
                <BookCover book={book} size="sm" className="rounded-[2px]" />
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[0.6rem] leading-none text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  ×
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked([])}
              className="rounded-[10px] border border-rule-strong px-3.5 py-2.5 text-[0.84rem] text-ink-soft hover:border-accent hover:text-accent-strong"
            >
              空にする
            </button>
            <button
              type="button"
              onClick={() => {
                for (const book of picked) onPick(book);
                setPicked([]);
                onClose();
              }}
              className="flex-1 rounded-[10px] bg-accent px-4 py-2.5 text-[0.9rem] font-bold text-accent-ink hover:bg-accent-strong"
            >
              {picked.length} 冊を棚に入れる
            </button>
          </div>
        </div>
      )}

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
                className="rounded-[9px] border border-rule bg-sunk zoom-safe px-3 py-2 text-[0.88rem] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
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
                className="rounded-[9px] border border-rule bg-sunk zoom-safe px-3 py-2 text-[0.88rem] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
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
                className="flex-1 rounded-[10px] bg-accent px-4 py-2.5 text-[0.88rem] font-bold text-accent-ink disabled:opacity-40 enabled:hover:bg-accent-strong"
              >
                この教材を追加
              </button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/*
        ★ **楽天サイトへのリンクをここに1つ置く。**

        楽天ウェブサービス規約 第8条4項は、ウェブサービスを使っている画面に
        楽天サイトへのリンクを置くことを求めている（CLAUDE.md 7章）。
        結果の行から外したぶん、**一覧の下にまとめて1つ**置く。
        これなら本を選ぶときに押し間違えない。

        クレジット表記（`RakutenCredit`）の行き先は developers.rakuten.com で、
        **楽天サイトそのものではない**ので、これの代わりにはならない。

        文言は「探す」にとどめる。購入やクリックの呼びかけは
        第10条1項(1) の禁止事項。
      */}
      <div className="flex flex-col items-center gap-1.5 border-t border-rule px-4 py-2.5">
        <a
          href={`https://books.rakuten.co.jp/search?sitem=${encodeURIComponent(query.trim())}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.74rem] text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          楽天ブックスで探す
        </a>
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

/**
 * ★ **打った語を薄くして、違うところを浮かせる。**
 *
 * 「英検2級」で引くと、全部の行に「英検2級」が入る。**同じ語が繰り返されると、
 * 読むべき「過去問集」「二次試験」の方が埋もれる。**
 * 打った語は既に分かっているので、そこを沈めて差分を読ませる。
 *
 * 強調（太字）ではなく減光にしているのは、**目立たせたいのが逆だから。**
 */
function Title({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  // 打った語で切って、挟まれた部分だけ通常の濃さで出す
  const parts: Array<{ text: string; hit: boolean }> = [];
  let rest = text;
  let guard = 0;
  while (guard++ < 20) {
    const at = rest.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) break;
    if (at > 0) parts.push({ text: rest.slice(0, at), hit: false });
    parts.push({ text: rest.slice(at, at + needle.length), hit: true });
    rest = rest.slice(at + needle.length);
  }
  if (rest) parts.push({ text: rest, hit: false });
  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <span key={i} className="text-ink-faint">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function ResultCard({
  book,
  added,
  picked,
  query,
  onToggle,
}: {
  book: Book;
  /** もうロードマップに入っている。押せない */
  added: boolean;
  /** これから入れるものとして選ばれている */
  picked: boolean;
  /** 打った語。書名の中のこの部分を沈める */
  query: string;
  onToggle: () => void;
}) {
  const label = sourceLabel(book);
  const meta = [book.author, book.publishedYear].filter(Boolean).join("・");

  return (
    <div
      role="button"
      tabIndex={added ? undefined : 0}
      aria-disabled={added}
      aria-label={book.title}
      aria-pressed={added ? undefined : picked}
      onClick={added ? undefined : onToggle}
      onKeyDown={
        added
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
      }
      className={`group flex flex-col gap-1.5 rounded-[10px] p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        added ? "opacity-45" : picked ? "cursor-pointer bg-accent-soft" : "cursor-pointer hover:bg-sunk"
      }`}
    >
      {/*
        表紙。**縦横比はそのまま**（棚と同じ理由。切ると縦長の本の上下が削られる）。
        高さを揃えるため、箱の中で下端に置く。
      */}
      <span className="relative flex h-[143px] items-end justify-center">
        <BookCover book={book} size="grid" className="max-h-full w-auto" />

        {/* 入れたことは表紙の上で言う。行が消えると何を入れたのか分からない */}
        {added && (
          <span className="absolute inset-0 grid place-items-center rounded-[4px] bg-paper/70">
            <span className="rounded-full bg-ink-soft px-2.5 py-1 text-[0.72rem] font-bold text-paper">
              追加済み
            </span>
          </span>
        )}

        {/*
          選んだ印。**表紙を隠さない。** どれを選んだかは一目で要るが、
          絵で選んでいる最中（8章）なので表紙を覆うと見比べられなくなる。
          角に小さく置いて、枠で囲うことで選ばれていると分かる形にする。
        */}
        {!added && picked && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[4px] ring-2 ring-accent"
            />
            <span
              aria-hidden
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[0.68rem] font-bold leading-none text-accent-ink shadow-sm"
            >
              ✓
            </span>
          </>
        )}
      </span>

      <span className="min-w-0">
        <span className="block text-[0.8rem] leading-[1.4] line-clamp-2">
          <Title text={book.title} query={query} />
        </span>
        <span className="mt-0.5 block truncate text-[0.66rem] text-ink-faint">
          {meta}
          {meta && label ? "・" : ""}
          {label}
        </span>
      </span>
    </div>
  );
}
