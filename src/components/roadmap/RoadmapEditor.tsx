"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

import { LoginButton } from "@/components/auth/LoginButton";
import { DetailSheet } from "@/components/sheets/DetailSheet";
import { SearchSheet } from "@/components/sheets/SearchSheet";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { Sheet } from "@/components/sheets/Sheet";
import { Toast } from "@/components/ui/Toast";
import { FlagIcon, ShareIcon } from "@/components/ui/icons";
import { loadLocalRoadmap, saveLocal } from "@/lib/db/local";
import { keyBetween } from "@/lib/roadmaps/reorder";
import { createRoadmapSync } from "@/lib/roadmaps/sync";
import { UNTITLED } from "@/lib/roadmaps/title";
import { allItems, isStageDone } from "@/types/roadmap";
import type { Book, Roadmap, RoadmapItem, RoadmapStage, RoadmapSummary } from "@/types/roadmap";

import { CompletionSheet } from "./CompletionSheet";
import { RoadmapDrawer } from "./RoadmapDrawer";
import { Shelf } from "./Shelf";

/**
 * 走りきった知らせを出したか。ルートごとに覚える。
 * 印を付け直すたびに祝われると鬱陶しいので、一度きりにする。
 */
function completionKey(roadmapId: string): string {
  return `completed:${roadmapId}`;
}

function seenCompletion(roadmapId: string): boolean {
  try {
    return localStorage.getItem(completionKey(roadmapId)) !== null;
  } catch {
    return false;
  }
}

function rememberCompletion(roadmapId: string): void {
  try {
    localStorage.setItem(completionKey(roadmapId), "1");
  } catch {
    /* 覚えられなくても動作は変わらない */
  }
}

type Props = {
  roadmap: Roadmap;
  books: Book[];
  /** ドロワーに出す一覧。サーバーにあるぶんだけで、手元のぶんは中で足す */
  summaries: RoadmapSummary[];
};

export function RoadmapEditor({ roadmap, books: initialBooks, summaries }: Props) {
  const [doc, setDoc] = useState<Roadmap>(roadmap);
  const [books, setBooks] = useState<Record<string, Book>>(() =>
    Object.fromEntries(initialBooks.map((b) => [b.id, b])),
  );
  const [hydrated, setHydrated] = useState(false);

  /** 検索シートを開いた段。追加先が決まっていないと本の行き先がない */
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [stageMenuId, setStageMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  /** 外したものの控え。猶予のあいだだけ持つ */
  const [removed, setRemoved] = useState<{
    item: RoadmapItem;
    stageId: string;
    index: number;
  } | null>(null);
  const pendingRemove = useRef<{
    flush: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  const items = useMemo(() => allItems(doc), [doc]);
  const doneCount = items.filter((i) => i.isDone).length;

  /**
   * 見出しの高さを中身に合わせる。折り返す長さの名前でも切れないようにするため。
   * 状態は動かさないので副作用で書いてよい
   */
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [doc.title]);

  /**
   * 起動時にローカルの内容で置き換える。
   *
   * URLが id を持っているので、ローカルとサーバーは必ず同じ文書を指す。
   * 同じ文書ならローカルの方が新しい（操作のたびに書いているため）。
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

  /** 操作のたびに丸ごと保存する。待たせないので画面は止まらない */
  useEffect(() => {
    if (!hydrated) return;
    // 開いただけで何もしていないものは残さない
    if (items.length === 0 && doc.title.trim() === "") return;
    void saveLocal({ roadmap: doc, books: Object.values(books) });
  }, [hydrated, doc, books, items.length]);

  const sync = useMemo(
    () => createRoadmapSync({ id: doc.id, shareSlug: doc.shareSlug }, { onError: setToast }),
    [doc.id, doc.shareSlug],
  );

  // 名前を預けておく。まだ roadmaps の行が無いとき、作る瞬間の名前になる
  useEffect(() => {
    sync.rememberTitle(doc.title);
  }, [sync, doc.title]);

  /** 猶予のあいだに画面を離れたら、その場でサーバーからも消す */
  useEffect(
    () => () => {
      if (pendingRemove.current) {
        clearTimeout(pendingRemove.current.timer);
        pendingRemove.current.flush();
        pendingRemove.current = null;
      }
    },
    [],
  );

  /** 段の中身を書き換える小道具 */
  const patchStage = useCallback(
    (stageId: string, fn: (stage: RoadmapStage) => RoadmapStage) => {
      setDoc((d) => ({
        ...d,
        stages: d.stages.map((s) => (s.id === stageId ? fn(s) : s)),
      }));
    },
    [],
  );

  const findItem = useCallback(
    (itemId: string) => {
      for (const stage of doc.stages) {
        const index = stage.items.findIndex((i) => i.id === itemId);
        if (index >= 0) return { stage, index, item: stage.items[index] };
      }
      return null;
    },
    [doc.stages],
  );

  const changeTitle = useCallback((next: string) => {
    setDoc((d) => ({ ...d, title: next }));
  }, []);

  const commitTitle = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      const title = e.currentTarget.value.trim();
      setDoc((d) => (d.title === title ? d : { ...d, title }));
      void sync.setTitle(title);
    },
    [sync],
  );

  const onTitleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    e.currentTarget.blur();
  }, []);

  const patchItem = useCallback(
    (itemId: string, next: Partial<RoadmapItem>) => {
      const found = findItem(itemId);
      if (!found) return;
      patchStage(found.stage.id, (s) => ({
        ...s,
        items: s.items.map((i) => (i.id === itemId ? { ...i, ...next } : i)),
      }));
      void sync.patchItem(itemId, next);
    },
    [findItem, patchStage, sync],
  );

  /** 段の玉を押したとき。段の中の本をまとめて切り替える */
  const toggleStage = useCallback(
    (stageId: string) => {
      const stage = doc.stages.find((s) => s.id === stageId);
      if (!stage || stage.items.length === 0) return;
      const next = !isStageDone(stage);

      patchStage(stageId, (s) => ({
        ...s,
        items: s.items.map((i) => ({ ...i, isDone: next })),
      }));
      for (const item of stage.items) {
        if (item.isDone !== next) void sync.patchItem(item.id, { isDone: next });
      }

      const allDone =
        next && doc.stages.every((s) => s.id === stageId || isStageDone(s));
      if (allDone && items.length > 0 && !seenCompletion(doc.id)) {
        rememberCompletion(doc.id);
        setCompleted(true);
      }
    },
    [doc.stages, doc.id, items.length, patchStage, sync],
  );

  /** 本ごとの終了。段が全部終わったらそこで祝う */
  const toggleItemDone = useCallback(
    (itemId: string) => {
      const found = findItem(itemId);
      if (!found) return;
      const isDone = !found.item.isDone;
      patchItem(itemId, { isDone });

      const allDone =
        isDone &&
        doc.stages.every((s) =>
          s.id === found.stage.id
            ? s.items.every((i) => i.id === itemId || i.isDone)
            : isStageDone(s),
        );
      if (allDone && items.length > 0 && !seenCompletion(doc.id)) {
        rememberCompletion(doc.id);
        setCompleted(true);
      }
    },
    [doc.stages, doc.id, findItem, items.length, patchItem],
  );

  const addBook = useCallback(
    (book: Book) => {
      const stageId = addingTo ?? doc.stages[0]?.id;
      const stage = doc.stages.find((s) => s.id === stageId);
      if (!stage) return;

      const item: RoadmapItem = {
        id: crypto.randomUUID(),
        bookId: book.id,
        isDone: false,
        roundsTarget: null,
        note: "",
        fractionalIndex: keyBetween(stage.items[stage.items.length - 1], undefined),
      };

      setBooks((prev) => ({ ...prev, [book.id]: book }));
      patchStage(stage.id, (s) => ({ ...s, items: [...s.items, item] }));
      setAddingTo(null);

      // ここが「最初の書き込み」になることがある
      void sync.addItem(item, book, stage);
    },
    [addingTo, doc.stages, patchStage, sync],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const found = findItem(itemId);
      if (!found) return;

      patchStage(found.stage.id, (s) => ({
        ...s,
        items: s.items.filter((i) => i.id !== itemId),
      }));
      setRemoved({ item: found.item, stageId: found.stage.id, index: found.index });

      const flush = () => void sync.removeItem(itemId);
      const timer = setTimeout(() => {
        pendingRemove.current = null;
        setRemoved(null);
        flush();
      }, 6000);
      pendingRemove.current = { flush, timer };
    },
    [findItem, patchStage, sync],
  );

  const undoRemove = useCallback(() => {
    if (pendingRemove.current) {
      clearTimeout(pendingRemove.current.timer);
      pendingRemove.current = null;
    }
    if (removed) {
      patchStage(removed.stageId, (s) => {
        const next = [...s.items];
        next.splice(Math.min(removed.index, next.length), 0, removed.item);
        return { ...s, items: next };
      });
    }
    setRemoved(null);
  }, [removed, patchStage]);

  /**
   * 棚の中で左右に動かす。**ドラッグは使わない。**
   * 横スクロールと掴む操作は両立しない（9章）ので、シートから動かす。
   */
  const shiftItem = useCallback(
    (itemId: string, direction: -1 | 1) => {
      const found = findItem(itemId);
      if (!found) return;
      const to = found.index + direction;
      if (to < 0 || to >= found.stage.items.length) return;

      const next = [...found.stage.items];
      const [moved] = next.splice(found.index, 1);
      next.splice(to, 0, moved);

      const fractionalIndex = keyBetween(next[to - 1], next[to + 1]);
      next[to] = { ...next[to], fractionalIndex };

      patchStage(found.stage.id, (s) => ({ ...s, items: next }));
      void sync.patchItem(itemId, { fractionalIndex });
    },
    [findItem, patchStage, sync],
  );

  /** 別の段へ移す */
  const moveItemToStage = useCallback(
    (itemId: string, stageId: string) => {
      const found = findItem(itemId);
      const target = doc.stages.find((s) => s.id === stageId);
      if (!found || !target || found.stage.id === stageId) return;

      const fractionalIndex = keyBetween(target.items[target.items.length - 1], undefined);
      const moved = { ...found.item, fractionalIndex };

      setDoc((d) => ({
        ...d,
        stages: d.stages.map((s) => {
          if (s.id === found.stage.id) {
            return { ...s, items: s.items.filter((i) => i.id !== itemId) };
          }
          if (s.id === stageId) return { ...s, items: [...s.items, moved] };
          return s;
        }),
      }));
      void sync.moveItem(itemId, stageId, fractionalIndex);
      setToast(`「${target.name || "名前のない段"}」へ移した`);
    },
    [doc.stages, findItem, sync],
  );

  const addStage = useCallback(() => {
    const last = doc.stages[doc.stages.length - 1];
    const stage: RoadmapStage = {
      id: crypto.randomUUID(),
      name: "",
      items: [],
      fractionalIndex: keyBetween(last, undefined),
    };
    setDoc((d) => ({ ...d, stages: [...d.stages, stage] }));
    void sync.addStage(stage);
  }, [doc.stages, sync]);

  const renameStage = useCallback(
    (stageId: string, name: string) => {
      patchStage(stageId, (s) => (s.name === name ? s : { ...s, name }));
      void sync.renameStage(stageId, name);
    },
    [patchStage, sync],
  );

  /**
   * 段を上下に動かす。本と同じで**ドラッグは使わない。**
   * 段の中が横スクロールなので、縦のドラッグと取り合いになる
   */
  const shiftStage = useCallback(
    (stageId: string, direction: -1 | 1) => {
      const from = doc.stages.findIndex((s) => s.id === stageId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= doc.stages.length) return;

      const next = [...doc.stages];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      const fractionalIndex = keyBetween(next[to - 1], next[to + 1]);
      next[to] = { ...next[to], fractionalIndex };

      setDoc((d) => ({ ...d, stages: next }));
      void sync.moveStage(stageId, fractionalIndex);
    },
    [doc.stages, sync],
  );

  /** 段を消すと中の参考書も一緒に消える。最後の1段は残す */
  const removeStage = useCallback(
    (stageId: string) => {
      if (doc.stages.length <= 1) return;
      const stage = doc.stages.find((s) => s.id === stageId);
      setStageMenuId(null);
      setDoc((d) => ({ ...d, stages: d.stages.filter((s) => s.id !== stageId) }));
      void sync.removeStage(stageId);
      setToast(
        stage && stage.items.length > 0
          ? `段と、中の${stage.items.length}冊を消した`
          : "段を消した",
      );
    },
    [doc.stages, sync],
  );

  const detail = detailId ? findItem(detailId) : null;
  const detailBook = detail ? (books[detail.item.bookId] ?? null) : null;
  const stageMenu = stageMenuId ? doc.stages.find((s) => s.id === stageMenuId) : null;
  const present = useMemo(() => new Set(items.map((i) => i.bookId)), [items]);

  return (
    <div data-touch-surface className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-1.5 px-3 pb-1 pt-2">
        <RoadmapDrawer serverSummaries={summaries} currentId={doc.id} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="共有する"
          className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ShareIcon size={18} />
        </button>
        <LoginButton next={`/roadmaps/${doc.id}`} />
      </header>

      <div className="px-4 pb-1 pt-1">
        <h1 className="mb-1">
          <textarea
            ref={titleRef}
            value={doc.title}
            onChange={(e) => changeTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={onTitleKeyDown}
            rows={1}
            placeholder={UNTITLED}
            aria-label="ルートの名前"
            className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-serif text-[1.3rem] font-semibold leading-[1.4] text-ink text-balance outline-none placeholder:text-ink-faint"
          />
        </h1>

        {doc.copiedFrom && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-thread-soft px-2.5 py-1.5 text-[0.76rem] text-ink-soft">
            <span>
              {doc.copiedFrom.authorName
                ? `${doc.copiedFrom.authorName}さんのルートをもとにしています`
                : "他の人のルートをもとにしています"}
            </span>
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

        <span className="font-mono text-[0.66rem] text-ink-faint">
          {items.length === 0 ? "まだ空" : `${doneCount}/${items.length} 終了`}
        </span>
      </div>

      <div className="flex-1 pb-16 pt-3">
        {doc.stages.map((stage, index) => (
          <div key={stage.id}>
            <Shelf
              stage={stage}
              index={index}
              books={books}
              onToggleStage={toggleStage}
              onRenameStage={renameStage}
              onOpenItem={setDetailId}
              onAddBook={setAddingTo}
              onOpenStageMenu={setStageMenuId}
            />
            <div className="h-4" />
          </div>
        ))}

        {/* 段を追加 */}
        <section className="relative pl-[46px]">
          <span className="absolute inset-y-0 left-[15px] flex w-[22px] justify-center">
            <span aria-hidden="true" className="absolute inset-y-0 w-[3px] rounded-sm bg-thread opacity-20" />
            <span
              aria-hidden="true"
              className="relative z-[2] mt-0.5 grid h-6 w-6 place-items-center self-start rounded-full border-[2.5px] border-dashed border-rule-strong bg-raised font-mono text-[0.72rem] text-ink-faint shadow-[0_0_0_4px_var(--raised)]"
            >
              ＋
            </span>
          </span>
          <div className="pr-4">
            <button
              type="button"
              onClick={addStage}
              className="w-full rounded-xl border-[1.5px] border-dashed border-rule-strong px-3.5 py-2.5 text-left text-[0.88rem] text-ink-soft hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
            >
              段を追加
            </button>
          </div>
          <div className="h-4" />
        </section>

        {/* GOAL */}
        <section className="relative pl-[46px]">
          <span className="absolute left-[15px] top-0 flex h-8 w-[22px] justify-center">
            <span aria-hidden="true" className="absolute top-0 h-2.5 w-[3px] rounded-sm bg-thread opacity-[0.28]" />
            <span className="relative z-[2] mt-0.5 grid h-6 w-6 place-items-center self-start rounded-full bg-thread text-white shadow-[0_0_0_4px_var(--raised)]">
              <FlagIcon size={12} />
            </span>
          </span>
          <span className="inline-block pt-1 font-mono text-[0.68rem] tracking-[0.16em] text-ink-faint">
            GOAL
          </span>
        </section>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />

      <Toast
        message={removed ? `「${books[removed.item.bookId]?.title ?? "参考書"}」を外した` : null}
        onDismiss={() => setRemoved(null)}
        durationMs={6000}
        action={{ label: "取り消す", onClick: undoRemove }}
      />

      <CompletionSheet
        open={completed}
        onClose={() => setCompleted(false)}
        count={items.length}
        onShare={() => setShareOpen(true)}
        next={`/roadmaps/${doc.id}`}
      />

      <SearchSheet
        open={addingTo !== null}
        onClose={() => setAddingTo(null)}
        onPick={addBook}
        present={present}
      />

      <DetailSheet
        item={detail?.item ?? null}
        book={detailBook}
        stages={doc.stages}
        currentStageId={detail?.stage.id ?? null}
        canMoveLeft={detail ? detail.index > 0 : false}
        canMoveRight={detail ? detail.index < detail.stage.items.length - 1 : false}
        onClose={() => setDetailId(null)}
        onPatch={patchItem}
        onToggleDone={toggleItemDone}
        onShift={shiftItem}
        onMoveToStage={moveItemToStage}
        onRemove={removeItem}
      />

      <Sheet
        open={stageMenu !== undefined && stageMenu !== null}
        onClose={() => setStageMenuId(null)}
        title="段の設定"
      >
        {stageMenu && (
          <div className="flex flex-col gap-3 px-4 pb-5 pt-1">
            <div className="rounded-[10px] bg-sunk px-3.5 py-3">
              <div className="text-[0.95rem] font-medium">
                {stageMenu.name || "名前のない段"}
              </div>
              <div className="mt-0.5 font-mono text-[0.7rem] text-ink-faint">
                参考書 {stageMenu.items.length} 冊
              </div>
            </div>

            {doc.stages.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className="text-[0.78rem] font-medium text-ink-soft">並べ替え</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={doc.stages[0]?.id === stageMenu.id}
                    onClick={() => shiftStage(stageMenu.id, -1)}
                    className="flex-1 rounded-lg border border-rule bg-sunk py-2 text-[0.82rem] text-ink-soft disabled:opacity-40 enabled:hover:border-accent enabled:hover:text-accent-strong"
                  >
                    ↑ 上へ
                  </button>
                  <button
                    type="button"
                    disabled={doc.stages[doc.stages.length - 1]?.id === stageMenu.id}
                    onClick={() => shiftStage(stageMenu.id, 1)}
                    className="flex-1 rounded-lg border border-rule bg-sunk py-2 text-[0.82rem] text-ink-soft disabled:opacity-40 enabled:hover:border-accent enabled:hover:text-accent-strong"
                  >
                    ↓ 下へ
                  </button>
                </div>
              </div>
            )}

            {doc.stages.length > 1 ? (
              <>
                <p className="text-[0.82rem] leading-relaxed text-ink-faint">
                  中の参考書も一緒に消えます。
                </p>
                <button
                  type="button"
                  onClick={() => removeStage(stageMenu.id)}
                  className="w-full rounded-[10px] border border-thread px-4 py-3 text-[0.9rem] font-medium text-thread hover:bg-thread-soft"
                >
                  この段を消す
                </button>
              </>
            ) : (
              <p className="text-[0.82rem] leading-relaxed text-ink-faint">
                最後の1段は消せません。
              </p>
            )}

            <button
              type="button"
              onClick={() => setStageMenuId(null)}
              className="w-full py-1 text-[0.82rem] text-ink-soft underline underline-offset-[3px] hover:text-ink"
            >
              閉じる
            </button>
          </div>
        )}
      </Sheet>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        isPublic={doc.isPublic}
        onChangePublic={(next) => {
          setDoc((d) => ({ ...d, isPublic: next }));
          void sync.setPublic(next);
        }}
        shareSlug={doc.shareSlug}
        title={doc.title}
        bookCount={items.length}
      />
    </div>
  );
}
