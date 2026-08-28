"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";

import { DetailSheet } from "@/components/sheets/DetailSheet";
import { SearchSheet } from "@/components/sheets/SearchSheet";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { Toast } from "@/components/ui/Toast";
import { ShareIcon } from "@/components/ui/icons";
import { moveItem } from "@/lib/roadmaps/reorder";
import { createRoadmapSync } from "@/lib/roadmaps/sync";
import type { Book, Roadmap, RoadmapItem } from "@/types/roadmap";

import { RouteGoal, RouteStart } from "./RouteMarkers";
import { StaticRoute } from "./StaticRoute";
import type { RouteListProps } from "./StaticRoute";

type Props = {
  roadmap: Roadmap;
  books: Book[];
};

export function RoadmapEditor({ roadmap, books: initialBooks }: Props) {
  const [items, setItems] = useState<RoadmapItem[]>(roadmap.items);
  const [books, setBooks] = useState<Record<string, Book>>(() =>
    Object.fromEntries(initialBooks.map((b) => [b.id, b])),
  );
  const [isPublic, setIsPublic] = useState(roadmap.isPublic);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
   * 画面の操作を Supabase へ反映する層。画面の状態はここが持ったまま、
   * 書き込みは追いかけて走る。Supabase が未設定なら何もしない。
   */
  const sync = useMemo(
    () => createRoadmapSync(roadmap, { onError: setToast }),
    [roadmap],
  );

  const present = useMemo(() => new Set(items.map((i) => i.bookId)), [items]);
  const doneCount = items.filter((i) => i.isDone).length;

  const patch = useCallback(
    (itemId: string, next: Partial<RoadmapItem>) => {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...next } : i)));
      void sync.patchItem(itemId, next);
    },
    [sync],
  );

  const toggleDone = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const isDone = !item.isDone;
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, isDone } : i)));
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

      setItems(next);
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
      setItems((prev) => [...prev, item]);
      setSearchOpen(false);

      // ここが「最初の書き込み」になることがある。
      // 匿名サインインと roadmaps の行の作成はこの中で初めて走る
      void sync.addItem(item, book);
    },
    [items, sync],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      void sync.removeItem(itemId);
      // TODO(未確定): 削除後に数秒「取り消す」を出す（CLAUDE.md 13章）
      setToast("ルートから外した。");
    },
    [sync],
  );

  const changePublic = useCallback(
    (next: boolean) => {
      setIsPublic(next);
      void sync.setPublic(next);
    },
    [sync],
  );

  const detailItem = detailId ? (items.find((i) => i.id === detailId) ?? null) : null;
  const detailBook = detailItem ? (books[detailItem.bookId] ?? null) : null;

  return (
    <div data-touch-surface className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-1.5 border-b border-rule px-4 pb-2.5 pt-3">
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
        <button
          type="button"
          className="flex-none rounded-full border border-rule-strong px-3 py-1 text-[0.75rem] text-ink-soft hover:border-ink-faint hover:bg-sunk hover:text-ink"
        >
          ログイン
        </button>
      </header>

      <div className="px-4 pb-1 pt-4">
        <h1 className="mb-2.5 font-serif text-[1.36rem] font-semibold leading-[1.42] text-balance">
          {roadmap.title}
        </h1>

        {roadmap.copiedFrom && (
          <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-thread-soft px-2.5 py-1.5 text-[0.76rem] text-ink-soft">
            <span>
              {roadmap.copiedFrom.authorName
                ? `${roadmap.copiedFrom.authorName}さんのルートをもとにしています`
                : "他の人のルートをもとにしています"}
            </span>
            {/* 元が消えていればリンクだけが外れ、この表示自体は残る（CLAUDE.md 6章） */}
            {roadmap.copiedFrom.roadmapId && (
              <a
                href={`/r/${roadmap.copiedFrom.roadmapId}`}
                className="ml-auto text-thread underline underline-offset-2"
              >
                元を見る
              </a>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {roadmap.tags.map((tag) => (
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

        {items.length === 0 && (
          <div className="py-6 pl-[2.55rem] text-[0.86rem] text-ink-faint">
            まだ1冊も置かれていない
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
        shareSlug={roadmap.shareSlug}
        title={roadmap.title}
        bookCount={items.length}
      />
    </div>
  );
}
