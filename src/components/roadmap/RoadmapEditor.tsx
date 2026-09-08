"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FocusEvent, KeyboardEvent } from "react";

import { LoginButton } from "@/components/auth/LoginButton";
import { DetailSheet } from "@/components/sheets/DetailSheet";
import { SearchSheet } from "@/components/sheets/SearchSheet";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { Toast } from "@/components/ui/Toast";
import { ShareIcon } from "@/components/ui/icons";
import { loadLocalRoadmap, saveLocal } from "@/lib/db/local";
import { moveItem } from "@/lib/roadmaps/reorder";
import { createRoadmapSync } from "@/lib/roadmaps/sync";
import { UNTITLED } from "@/lib/roadmaps/title";
import type { Book, Roadmap, RoadmapItem, RoadmapSummary } from "@/types/roadmap";

import { RoadmapDrawer } from "./RoadmapDrawer";
import { RouteGoal, RouteStart } from "./RouteMarkers";
import { StaticRoute } from "./StaticRoute";
import type { RouteListProps } from "./StaticRoute";

type Props = {
  roadmap: Roadmap;
  books: Book[];
  /** ドロワーに出す一覧。サーバーにあるぶんだけで、手元のぶんは中で足す */
  summaries: RoadmapSummary[];
};

export function RoadmapEditor({ roadmap, books: initialBooks, summaries }: Props) {
  /**
   * ロードマップ1件をまるごと1つの状態として持つ。
   * IndexedDB へも丸ごと書くので、画面の状態と保存されるものが常に一致する。
   */
  const [doc, setDoc] = useState<Roadmap>(roadmap);
  const [books, setBooks] = useState<Record<string, Book>>(() =>
    Object.fromEntries(initialBooks.map((b) => [b.id, b])),
  );
  /** IndexedDB を読み終わるまでは書き戻さない。サーバーの初期値で上書きしないため */
  const [hydrated, setHydrated] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const items = doc.items;
  const isPublic = doc.isPublic;

  /**
   * dnd-kit は初回表示に不要なので初期バンドルから外し、描画後に読み込んで
   * 差し替える（CLAUDE.md 10章）。届くまでは並び替えできない経路を出しておく。
   */
  const [RouteList, setRouteList] = useState<ComponentType<RouteListProps>>(() => StaticRoute);
  useEffect(() => {
    let alive = true;
    import("./SortableRoute").then((mod) => {
      if (alive) setRouteList(() => mod.SortableRoute);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 見出しの高さを中身に合わせる。折り返す長さの名前でも切れないようにするため。
   * 状態は動かさないので副作用で書いてよい
   */
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [doc.title]);

  /**
   * 起動時にローカルの内容で置き換える。
   *
   * URLが id を持っているので、ローカルとサーバーは**必ず同じ文書**を指す。
   * 同じ文書ならローカルの方が新しい（操作のたびに書いているため）ので、
   * あればローカルを採る。無ければサーバーが渡してきたものをそのまま使う。
   *
   * サーバーが placeholder のとき（ログイン前に作ったもの）は、そもそも
   * サーバー側に実体が無い。それが正常な状態（CLAUDE.md 5章）。
   *
   * ※ 別の端末で編集したものがサーバーにある場合、ここで古いローカルが
   *   勝ってしまう。更新時刻を見た突き合わせは未実装（14章の未決事項）。
   */
  useEffect(() => {
    let alive = true;
    loadLocalRoadmap(roadmap.id).then((local) => {
      if (!alive) return;
      if (local) {
        setDoc(local.roadmap);
        setBooks(Object.fromEntries(local.books.map((b) => [b.id, b])));
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [roadmap.id]);

  /**
   * 操作のたびに丸ごと保存する。待たせないので画面は止まらない。
   * ロードマップ1件は数KBしかないので、差分を取るより丸ごと書く方が壊れない。
   */
  useEffect(() => {
    if (!hydrated) return;
    // 開いただけで何もしていないものは残さない。
    // 一覧が空のルートで埋まると、切り替える道具として使い物にならなくなる
    if (doc.items.length === 0 && doc.title.trim() === "") return;
    void saveLocal({ roadmap: doc, books: Object.values(books) });
  }, [hydrated, doc, books]);

  /**
   * IndexedDB の裏で Supabase へ送る層。未設定なら何もしない。
   * ここが失敗しても IndexedDB には書けているので、操作は失われない。
   *
   * ロードマップ1件につき1つだけ作る。タイトルの打鍵ごとに作り直すと、
   * 「roadmaps の行を用意したか」の記憶が消えて毎回 upsert しに行ってしまう。
   * そのため名前はここでは渡さず、別に預ける。
   */
  const sync = useMemo(
    () => createRoadmapSync({ id: doc.id, shareSlug: doc.shareSlug }, { onError: setToast }),
    [doc.id, doc.shareSlug],
  );

  // 名前を預けておく。まだ roadmaps の行が無いとき、作る瞬間の名前になる
  useEffect(() => {
    sync.rememberTitle(doc.title);
  }, [sync, doc.title]);

  const present = useMemo(() => new Set(items.map((i) => i.bookId)), [items]);
  const doneCount = items.filter((i) => i.isDone).length;

  const patch = useCallback(
    (itemId: string, next: Partial<RoadmapItem>) => {
      setDoc((d) => ({
        ...d,
        items: d.items.map((i) => (i.id === itemId ? { ...i, ...next } : i)),
      }));
      void sync.patchItem(itemId, next);
    },
    [sync],
  );

  const toggleDone = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const isDone = !item.isDone;
      setDoc((d) => ({
        ...d,
        items: d.items.map((i) => (i.id === itemId ? { ...i, isDone } : i)),
      }));
      void sync.patchItem(itemId, { isDone });
    },
    [items, sync],
  );

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      const next = moveItem(items, activeId, overId);
      const moved = next.findIndex((i) => i.id === activeId);
      if (moved < 0) return;

      // 前後の行の間に挟むキーを作る。**動かした行だけ**を更新すれば済む
      const fractionalIndex = sync.keyBetween(next[moved - 1], next[moved + 1]);
      next[moved] = { ...next[moved], fractionalIndex };

      setDoc((d) => ({ ...d, items: next }));
      void sync.patchItem(activeId, { fractionalIndex });
    },
    [items, sync],
  );

  const addBook = useCallback(
    (book: Book) => {
      const item: RoadmapItem = {
        id: crypto.randomUUID(),
        bookId: book.id,
        isDone: false,
        roundsTarget: null,
        note: "",
        // 末尾に置くので、最後の行より後ろのキーを作る
        fractionalIndex: sync.keyBetween(items[items.length - 1], undefined),
      };

      setBooks((prev) => ({ ...prev, [book.id]: book }));
      setDoc((d) => ({ ...d, items: [...d.items, item] }));
      setSearchOpen(false);

      // ここが「最初の書き込み」になることがある。
      // 匿名サインインと roadmaps の行の作成はこの中で初めて走る
      void sync.addItem(item, book);
    },
    [items, sync],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setDoc((d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }));
      void sync.removeItem(itemId);
      // TODO(未確定): 削除後に数秒「取り消す」を出す（CLAUDE.md 13章）
      setToast("ルートから外した。");
    },
    [sync],
  );

  const changePublic = useCallback(
    (next: boolean) => {
      setDoc((d) => ({ ...d, isPublic: next }));
      void sync.setPublic(next);
    },
    [sync],
  );

  /** 打鍵のたびに走る。ローカルへの保存は即時（CLAUDE.md 5章） */
  const changeTitle = useCallback((next: string) => {
    setDoc((d) => ({ ...d, title: next }));
  }, []);

  /**
   * 入力欄から離れたとき。Supabase へ送るのはここだけ。
   *
   * **空のままでも構わない。** 名無しで困るのは一覧・共有ページ・OGPなので、
   * そちらで「無題のルート」を補う（lib/roadmaps/title.ts）。
   * ここで勝手に名前を付けると、消したはずの文字が戻ってきたように見える。
   *
   * 値は状態からではなく入力欄から読む。状態を経由すると、この関数が
   * 作られた時点の名前を見てしまい、打ち替えた直後の確定が1回ずれる。
   */
  const commitTitle = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      const title = e.currentTarget.value.trim();
      setDoc((d) => (d.title === title ? d : { ...d, title }));
      void sync.setTitle(title);
    },
    [sync],
  );

  /** 名前は1行。Enter で改行させず確定して閉じる */
  const onTitleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  const detailItem = detailId ? (items.find((i) => i.id === detailId) ?? null) : null;
  const detailBook = detailItem ? (books[detailItem.bookId] ?? null) : null;

  return (
    <div data-touch-surface className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-1.5 border-b border-rule px-4 pb-2.5 pt-3">
        <RoadmapDrawer serverSummaries={summaries} currentId={doc.id} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex flex-none items-center gap-1.5 rounded-full border border-rule-strong px-3 py-1 text-[0.75rem] text-ink-soft hover:border-ink-faint hover:bg-sunk hover:text-ink"
        >
          <ShareIcon />
          共有
        </button>
        {/* ログインは強制しない。ロードマップが仕上がった時点で促す（CLAUDE.md 5章） */}
        <LoginButton next={`/roadmaps/${doc.id}`} />
      </header>

      <div className="px-4 pb-1 pt-4">
        {/*
          名前は見出しをそのまま打ち替える形にした。編集ボタンも編集モードも置かない。
          ルートの名前を変えるのは多くて数回なので、動線を増やす方が邪魔になる。
        */}
        <h1 className="mb-2.5">
          <textarea
            ref={titleRef}
            value={doc.title}
            onChange={(e) => changeTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={onTitleKeyDown}
            rows={1}
            placeholder={UNTITLED}
            aria-label="ルートの名前"
            className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-serif text-[1.36rem] font-semibold leading-[1.42] text-ink text-balance outline-none placeholder:text-ink-faint focus:outline-none"
          />
        </h1>

        {/*
          保存状態の見せ方（CLAUDE.md 13章）。IndexedDB へは操作のたびに
          書いているので、読み込みが終わっていれば常に保存済み。
          Supabase への送信は裏で走るぶんなので、ここでは触れない
        */}
        {hydrated && (
          <span className="mb-2 inline-flex items-center gap-1.5 font-mono text-[0.6rem] text-ink-faint">
            <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-thread opacity-70" />
            保存済み
          </span>
        )}

        {doc.copiedFrom && (
          <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-thread-soft px-2.5 py-1.5 text-[0.76rem] text-ink-soft">
            <span>
              {doc.copiedFrom.authorName
                ? `${doc.copiedFrom.authorName}さんのルートをもとにしています`
                : "他の人のルートをもとにしています"}
            </span>
            {/* 元が消えていればリンクだけが外れ、この表示自体は残る（CLAUDE.md 6章） */}
            {doc.copiedFrom.roadmapId && (
              <a
                href={`/r/${doc.copiedFrom.roadmapId}`}
                className="ml-auto text-thread underline underline-offset-2"
              >
                元を見る
              </a>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {doc.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-transparent bg-accent-soft px-2.5 py-[0.12em] text-[0.72rem] text-accent-strong"
              >
                {tag}
              </span>
            ))}
            <button
              type="button"
              className="rounded-full border border-dashed border-rule-strong px-2.5 py-[0.12em] text-[0.72rem] text-ink-faint hover:border-ink-faint hover:text-ink-soft"
            >
              ＋ タグ
            </button>
          </div>
          <span className="flex-none font-mono text-[0.66rem] text-ink-faint">
            {doneCount}/{items.length} 終了
          </span>
        </div>
      </div>

      <div className="px-4 pb-6 pt-4">
        <RouteStart />

        <RouteList
          items={items}
          books={books}
          onToggleDone={toggleDone}
          onOpen={setDetailId}
          onReorder={reorder}
        />

        {/*
          白紙に放り出さない。紐と START / GOAL は最初から引いてあるので、
          置く場所が見えている状態から始まる
        */}
        {items.length === 0 && (
          <div className="py-5 pl-[2.55rem] text-[0.86rem] leading-[1.8] text-ink-soft">
            1冊目を置くと、
            <br />
            ここに道ができる。
          </div>
        )}

        {/* 追加は経路上の最後の点として置く（CLAUDE.md 8章） */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group flex w-full items-stretch gap-3 border-0 bg-transparent p-0 text-left"
        >
          <span aria-hidden="true" className="relative flex w-[22px] flex-none justify-center">
            <span className="absolute inset-y-0 w-[3px] rounded-sm bg-thread opacity-[0.28]" />
            <span className="relative mt-5 grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] border-dashed border-rule-strong bg-raised font-mono text-[0.67rem] text-ink-faint shadow-[0_0_0_3px_var(--raised)] group-hover:border-accent group-hover:text-accent">
              ＋
            </span>
          </span>
          <span className="my-2 flex-1 rounded-[10px] border-[1.5px] border-dashed border-rule-strong px-3.5 py-3 text-[0.86rem] text-ink-soft group-hover:border-accent group-hover:bg-accent-soft group-hover:text-accent-strong">
            参考書を追加
          </span>
        </button>

        <RouteGoal />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={addBook}
        present={present}
      />
      <DetailSheet
        item={detailItem}
        book={detailBook}
        onClose={() => setDetailId(null)}
        onPatch={patch}
        onRemove={removeItem}
      />
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        isPublic={isPublic}
        onChangePublic={changePublic}
        shareSlug={doc.shareSlug}
        title={doc.title}
        bookCount={items.length}
      />
    </div>
  );
}
