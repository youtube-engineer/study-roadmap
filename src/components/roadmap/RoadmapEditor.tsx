"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ComponentType, FocusEvent, KeyboardEvent } from "react";

import { LoginButton } from "@/components/auth/LoginButton";
import { DetailSheet } from "@/components/sheets/DetailSheet";
import { SearchSheet } from "@/components/sheets/SearchSheet";
import { ShareSheet } from "@/components/sheets/ShareSheet";
import { Sheet } from "@/components/sheets/Sheet";
import { Toast } from "@/components/ui/Toast";
import { FlagIcon, ShareIcon } from "@/components/ui/icons";
import { deleteLocalRoadmap, loadLocalRoadmap, saveLocal } from "@/lib/db/local";
import { keyBetween, orderByIndex, sealOrder } from "@/lib/roadmaps/reorder";
import { newShareSlug } from "@/lib/roadmaps/slug";
import { createRoadmapSync } from "@/lib/roadmaps/sync";
import { UNTITLED } from "@/lib/roadmaps/title";

/** ロードマップ名の上限。OGP画像が40字で切っているのに合わせる */
const TITLE_MAX = 40;

/**
 * ★ **キーの順に揃えてから描く。**
 *
 * 編集画面は配列の順を描き、共有ページは `fractional_index` の昇順で引く。
 * 揃えないと**共有したものだけ段がバラバラ**になる（`orderByIndex` のコメント）。
 * 壊れていたら振り直し、`repaired` を立てて呼び出し側に書き戻させる。
 */
function orderDoc(doc: Roadmap): { doc: Roadmap; repaired: boolean } {
  const stages = orderByIndex(doc.stages);
  let repaired = stages.repaired;

  const next = stages.rows.map((stage) => {
    const items = orderByIndex(stage.items);
    if (items.repaired) repaired = true;
    return items.repaired || items.rows !== stage.items ? { ...stage, items: items.rows } : stage;
  });

  return { doc: { ...doc, stages: next }, repaired };
}
import { allItems, isStageDone } from "@/types/roadmap";
import type { Book, Roadmap, RoadmapItem, RoadmapStage, RoadmapSummary } from "@/types/roadmap";

import { BookSpine } from "./BookSpine";
import { CompletionSheet } from "./CompletionSheet";
import { RoadmapDrawer } from "./RoadmapDrawer";
import { Shelf } from "./Shelf";
import type { RoadmapListProps } from "./SortableRoadmap";

/**
 * 並べ替えできない棚。dnd-kit のチャンクが届くまでのあいだ表示する。
 * 空の枠ではなく本物の棚を出すので、読む分には最初から成立している。
 */
function StaticRoadmap({ stages, books, ...handlers }: RoadmapListProps) {
  return (
    <>
      {stages.map((stage, index) => (
        <div key={stage.id} className="pb-5 md:pb-7">
        <Shelf stage={stage} index={index} {...handlers}>
          {stage.items.map((item) => {
            const book = books[item.bookId];
            if (!book) return null;
            return (
              <BookSpine
                key={item.id}
                item={item}
                book={book}
                onOpen={handlers.onOpenItem}
              />
            );
          })}
        </Shelf>
        </div>
      ))}
    </>
  );
}

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
  /**
   * サーバーに行があるか（`store.ts` の RoadmapSource）。
   * **`shareSlug` をどちらから採るかの判断に使う。**
   */
  serverHasRow: boolean;
  /** ドロワーに出す一覧。サーバーにあるぶんだけで、手元のぶんは中で足す */
  summaries: RoadmapSummary[];
};

export function RoadmapEditor({ roadmap, books: initialBooks, serverHasRow, summaries }: Props) {
  const router = useRouter();
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
  /** 段の削除は中身ごと消えるので、押した先でもう一度確かめる */
  const [confirmingStageId, setConfirmingStageId] = useState<string | null>(null);

  /**
   * dnd-kit は初回表示に不要なので初期バンドルから外し、描画後に読み込んで
   * 差し替える（CLAUDE.md 10章）。届くまでは並べ替えできない棚を出しておく。
   */
  const [List, setList] = useState<ComponentType<RoadmapListProps>>(() => StaticRoadmap);
  useEffect(() => {
    let alive = true;
    import("./SortableRoadmap").then((mod) => {
      if (alive) setList(() => mod.SortableRoadmap);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  /** 外したものの控え。猶予のあいだだけ持つ */
  const [removed, setRemoved] = useState<{
    item: RoadmapItem;
    stageId: string;
    index: number;
  } | null>(null);

  /**
   * 消した段の控え。**中の参考書ごと控える。**
   * 段を消すと本も一緒に消えるので、戻すときに本が無いと意味がない
   */
  const [removedStage, setRemovedStage] = useState<{
    stage: RoadmapStage;
    index: number;
  } | null>(null);
  const pendingStageRemove = useRef<{
    flush: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const pendingRemove = useRef<{
    flush: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  /**
   * サーバーが渡したぶん。**マウント中は変わらない**——ページ側が `key={id}` で
   * 作り直すので（CLAUDE.md 14章）。effect の依存に `roadmap` を足すと、
   * 参照が変わるたびに読み直して状態を書き、描画が連鎖する。
   */
  const serverDocRef = useRef(roadmap);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  /** その id が他人のものだった。振り直しを待っている状態 */
  const [idTaken, setIdTaken] = useState(false);

  /** 並び順の書き戻しは1回のマウントにつき1度だけ */
  const orderSyncedRef = useRef(false);

  /** 手元に控えがあったか。書き戻してよいのはこのときだけ（下の effect） */
  const hasLocalRef = useRef(false);
  const goalRef = useRef<HTMLTextAreaElement>(null);


  const items = useMemo(() => allItems(doc), [doc]);

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

  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [doc.goal]);

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
        /**
         * ★ **`shareSlug` だけはサーバーのものを使う。**
         *
         * 本文（名前・段・参考書）はローカルが新しいが、**共有の識別子は
         * サーバーが行を作った瞬間に決まる値**で、ローカルはそれを知らない。
         * 手元の `newShareSlug()` が作った別物が入っている。
         *
         * 丸ごと上書きすると、**共有シートが実在しないURLを出す**
         * （/r/<手元のslug> が404、実体は /r/<サーバーのslug>）。
         * 貼った相手が見られない形で出るので、気付くのが遅れる。
         *
         * サーバーにまだ行が無いとき（placeholder）は手元の値でよい——
         * 行が作られるときにその値が入る（sync.ts の ensureRoadmap）。
         */
        hasLocalRef.current = true;
        /**
         * ★ **`shareSlug` と `isPublic` はサーバーのものを使う。**
         *
         * 本文（名前・段・参考書）はローカルが新しいが、この2つは
         * **「外から何が見えるか」を決める値**で、サーバーが持っているものが
         * そのまま事実。手元の控えは古いことがある。
         *
         * 上書きすると**共有シートが嘘をつく**——非公開にしたのに別の端末では
         * 「公開中」と出る（`isPublic`）、実在しないURLを出す（`shareSlug`）。
         * どちらも**本人には気付けない形**で出る。
         */
        const ordered = orderDoc({
          ...local.roadmap,
          shareSlug: serverHasRow ? roadmap.shareSlug : local.roadmap.shareSlug,
          isPublic: serverHasRow ? roadmap.isPublic : local.roadmap.isPublic,
        });
        const fixed = ordered.doc;
        setDoc(fixed);
        setBooks(Object.fromEntries(local.books.map((b) => [b.id, b])));

        // ずれていたら手元も直す。次に開いたときにまた古い値から始めない
        if (
          fixed.shareSlug !== local.roadmap.shareSlug ||
          fixed.isPublic !== local.roadmap.isPublic ||
          ordered.repaired
        ) {
          void saveLocal({ roadmap: fixed, books: local.books });
        }
      } else {
        /**
         * 手元に無いときはサーバーのぶんを描く。そちらは既に昇順で引いて
         * あるが、**キーが壊れていれば昇順でも意味をなさない**ので揃える。
         */
        const ordered = orderDoc(serverDocRef.current);
        if (ordered.repaired) setDoc(ordered.doc);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [roadmap.id, roadmap.shareSlug, roadmap.isPublic, serverHasRow]);

  /** 操作のたびに丸ごと保存する。待たせないので画面は止まらない */
  useEffect(() => {
    if (!hydrated) return;
    // 開いただけで何もしていないものは残さない
    if (items.length === 0 && doc.title.trim() === "") return;
    void saveLocal({ roadmap: doc, books: Object.values(books) });
  }, [hydrated, doc, books, items.length]);

  /**
   * その id が既に他人のものだったら、**手元のロードマップに別の id を振り直す。**
   *
   * サーバーにはまだ何も入っていないので、振り直せばそのまま書けるようになる。
   * ログアウト時に手元を消しているので普通は起きないが、起きたときに
   * 「手元では動いて見えるのにサーバーには何も入らない」状態で止まらないようにする。
   */
  const sync = useMemo(
    () =>
      createRoadmapSync(
        { id: doc.id, shareSlug: doc.shareSlug },
        { onError: setToast, onIdTaken: () => setIdTaken(true) },
      ),
    [doc.id, doc.shareSlug],
  );

  /**
   * ★ **並び順をサーバーと合わせる。やることは2つで、どちらも「全部書く」。**
   *
   * 編集画面は配列の順で描き、共有ページは `fractional_index` で並べる。
   * **この2つは黙ってずれる**——ずれても本人の画面は正しいままなので、
   * **共有したものだけ段がバラバラ**という形でしか表に出ない。
   *
   * ⚠ **一部だけ書いてはいけない。** 書かなかった行は古いキーのまま残り、
   * **新しく書いたキーと衝突する。** 実際にこれで1本壊した——手元に5段しか
   * 無いのに9段あるロードマップへ `a0..a4` を書き、残り4段の `a3..a6` と
   * ぶつかって `a0` と `a1` が2つずつになった。
   * **直すつもりの処理が、開くたびに壊す処理になる。**
   */
  useEffect(() => {
    if (!hydrated || !serverHasRow || orderSyncedRef.current) return;

    /**
     * **手元に控えが無いなら触らない。** このブラウザで触っていない
     * ロードマップなので、押し付けてよい「正しい順」を持っていない。
     * 公開されている他人のものを開いただけで `ensureRoadmap()` を走らせると、
     * 所有者違いとして id を振り直してしまう（sync.ts の takeNewId）。
     */
    if (!hasLocalRef.current) return;

    const idsOf = (stages: RoadmapStage[]) => {
      const out = new Set<string>();
      for (const stage of stages) {
        out.add(stage.id);
        for (const item of stage.items) out.add(item.id);
      }
      return out;
    };

    const server = serverDocRef.current;
    const here = idsOf(doc.stages);
    const there = idsOf(server.stages);
    const sameRows = here.size === there.size && [...there].every((id) => here.has(id));

    /**
     * **何を正とするか。**
     *
     * 行の顔ぶれが一致するなら手元が正——このブラウザで並べた順そのもの。
     * 一致しないなら手元は古いので、**サーバーの行をサーバー自身の順で
     * 振り直すだけ**にする（見えているものは変えない）。
     * どちらが正しいか決められないときに手元を押し付けると、上の事故が起きる。
     */
    const truth = sameRows ? orderDoc(doc) : orderDoc(server);
    const rows: Array<{ id: string; index: string; isItem: boolean }> = [];
    for (const stage of truth.doc.stages) {
      if (stage.fractionalIndex) {
        rows.push({ id: stage.id, index: stage.fractionalIndex, isItem: false });
      }
      for (const item of stage.items) {
        if (item.fractionalIndex) {
          rows.push({ id: item.id, index: item.fractionalIndex, isItem: true });
        }
      }
    }

    const onServer = new Map<string, string | undefined>();
    for (const stage of server.stages) {
      onServer.set(stage.id, stage.fractionalIndex);
      for (const item of stage.items) onServer.set(item.id, item.fractionalIndex);
    }

    // 何も変わらないなら書かない。開くたびに update を投げても意味がない
    if (rows.every((r) => onServer.get(r.id) === r.index)) return;
    orderSyncedRef.current = true;

    /**
     * **差分だけでなく全行を書く。** 同じ値を書き直す無駄より、
     * 書き忘れた行が衝突する方がずっと高くつく。段と本で高々数十行。
     */
    for (const row of rows) {
      if (row.isItem) void sync.patchItem(row.id, { fractionalIndex: row.index });
      else void sync.moveStage(row.id, row.index);
    }

    // 振り直したなら手元もその値にしておく。次に開いたとき また書き直さない
    if (sameRows && truth.repaired) setDoc(truth.doc);
  }, [hydrated, serverHasRow, doc, sync]);

  /**
   * その id が既に他人のものだったら、**手元のロードマップに別の id を振り直す。**
   *
   * サーバーにはまだ何も入っていないので、振り直せばそのまま書けるようになる。
   * ログアウト時に手元を消しているので普通は起きないが、起きたときに
   * 「手元では動いて見えるのにサーバーには何も入らない」状態で止まらないようにする。
   *
   * ★ **順番を守ること。新しい id で保存してから、古い方を消す。**
   *
   * 逆にすると中身が消える。`router.replace` で `key={id}` の編集画面は
   * 作り直され、新しい id で IndexedDB を読みにいく。そこにまだ何も無ければ
   * **空のロードマップが出来上がり、元の中身はもう手元にも無い。**
   * 実際にこれで1本飛ばした。
   */
  useEffect(() => {
    if (!idTaken) return;
    const previousId = doc.id;
    const id = crypto.randomUUID();
    const next = { ...doc, id, shareSlug: newShareSlug() };

    void (async () => {
      await saveLocal({ roadmap: next, books: Object.values(books) });
      await deleteLocalRoadmap(previousId);
      setIdTaken(false);
      setDoc(next);
      router.replace(`/roadmaps/${id}`);
    })();
  }, [idTaken, doc, books, router]);

  // 名前を預けておく。まだ roadmaps の行が無いとき、作る瞬間の名前になる
  useEffect(() => {
    sync.rememberTitle(doc.title);
  }, [sync, doc.title]);

  // 同じ理由でゴールも預けておく
  useEffect(() => {
    sync.rememberGoal(doc.goal);
  }, [sync, doc.goal]);

  /** 猶予のあいだに画面を離れたら、その場でサーバーからも消す */
  useEffect(
    () => () => {
      if (pendingRemove.current) {
        clearTimeout(pendingRemove.current.timer);
        pendingRemove.current.flush();
        pendingRemove.current = null;
      }
      if (pendingStageRemove.current) {
        clearTimeout(pendingStageRemove.current.timer);
        pendingStageRemove.current.flush();
        pendingStageRemove.current = null;
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
    // 変換中の Enter は確定なので拾わない。拾うと名前が二重に入る
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    e.currentTarget.blur();
  }, []);

  const changeGoal = useCallback((next: string) => {
    setDoc((d) => ({ ...d, goal: next }));
  }, []);

  /** ゴールも名前と同じで、送るのは入力欄から離れたときだけ */
  const commitGoal = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      const goal = e.currentTarget.value.trim();
      setDoc((d) => (d.goal === goal ? d : { ...d, goal }));
      void sync.setGoal(goal);
    },
    [sync],
  );

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

  /**
   * 本ごとの終了。
   *
   * **終えた本は棚の右端へ寄せる。** 手前に残っていると、次にやる本が
   * 埋もれて見える。並び順のキーも打ち替えるので、リロードしても同じ位置にいる。
   */
  const toggleItemDone = useCallback(
    (itemId: string) => {
      const found = findItem(itemId);
      if (!found) return;
      const isDone = !found.item.isDone;

      const rest = found.stage.items.filter((i) => i.id !== itemId);
      // 終えたら末尾へ、戻したらまだ終えていない本の最後へ
      const at = isDone ? rest.length : rest.filter((i) => !i.isDone).length;
      const fractionalIndex = keyBetween(rest[at - 1], rest[at]);

      const moved = { ...found.item, isDone, fractionalIndex };
      const next = [...rest];
      next.splice(at, 0, moved);

      patchStage(found.stage.id, (st) => ({ ...st, items: next }));
      void sync.patchItem(itemId, { isDone, fractionalIndex });

      const allDone =
        isDone &&
        doc.stages.every((st) =>
          st.id === found.stage.id
            ? st.items.every((i) => i.id === itemId || i.isDone)
            : isStageDone(st),
        );
      if (allDone && items.length > 0 && !seenCompletion(doc.id)) {
        rememberCompletion(doc.id);
        setCompleted(true);
      }
    },
    [doc.stages, doc.id, findItem, items.length, patchStage, sync],
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
   * 参考書を（別の段かもしれない）位置へ移す。
   *
   * 段をまたぐ移動も同じ経路で扱う。握りは `touch-action: none` なので、
   * いったん掴めば方向の制限は無い（9章）。
   */
  const moveItem = useCallback(
    (itemId: string, toStageId: string, toIndex: number | null) => {
      const found = findItem(itemId);
      if (!found) return;
      if (found.stage.id === toStageId && found.index === toIndex) return;

      const target = doc.stages.find((s) => s.id === toStageId);
      if (!target) return;

      const remaining =
        found.stage.id === toStageId
          ? found.stage.items.filter((i) => i.id !== itemId)
          : target.items;
      const at = toIndex === null ? remaining.length : Math.min(toIndex, remaining.length);

      const fractionalIndex = keyBetween(remaining[at - 1], remaining[at]);
      const moved = { ...found.item, fractionalIndex };

      setDoc((d) => ({
        ...d,
        stages: d.stages.map((s) => {
          if (s.id === found.stage.id && s.id === toStageId) {
            const next = s.items.filter((i) => i.id !== itemId);
            next.splice(at, 0, moved);
            return { ...s, items: next };
          }
          if (s.id === found.stage.id) {
            return { ...s, items: s.items.filter((i) => i.id !== itemId) };
          }
          if (s.id === toStageId) {
            const next = [...s.items];
            next.splice(at, 0, moved);
            return { ...s, items: next };
          }
          return s;
        }),
      }));

      if (found.stage.id === toStageId) {
        void sync.patchItem(itemId, { fractionalIndex });
      } else {
        void sync.moveItem(itemId, toStageId, fractionalIndex);
      }

      /**
       * ★ **移した先の棚が、キーの順どおりに読めるか確かめる。**
       * `keyBetween` は前後しか見ないので、棚の中に壊れたキーがあると
       * ぶつかるキーを返すことがある。ぶつかったら棚ごと振り直す。
       */
      const after = [...(toStageId === found.stage.id ? remaining : target.items)];
      after.splice(at, 0, moved);
      const sealed = sealOrder(after);
      if (!sealed.renumbered) return;

      setDoc((d) => ({
        ...d,
        stages: d.stages.map((s) => (s.id === toStageId ? { ...s, items: sealed.rows } : s)),
      }));
      for (const item of sealed.rows) {
        void sync.patchItem(item.id, { fractionalIndex: item.fractionalIndex! });
      }
    },
    [doc.stages, findItem, sync],
  );

  /** 段の並び替え。玉を掴んで動かしたとき */
  const reorderStages = useCallback(
    (activeId: string, overId: string) => {
      const from = doc.stages.findIndex((s) => s.id === activeId);
      const to = doc.stages.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0 || from === to) return;

      const moving = [...doc.stages];
      const [moved] = moving.splice(from, 1);
      moving.splice(to, 0, moved);
      moving[to] = { ...moving[to], fractionalIndex: keyBetween(moving[to - 1], moving[to + 1]) };

      /**
       * ★ **挟んだキーが本当に収まっているか確かめる。**
       * `keyBetween` は前後しか見ないので、前後が壊れていると
       * 別の段とぶつかるキーを返すことがある。ぶつかったら全部振り直す。
       */
      const sealed = sealOrder(moving);
      setDoc((d) => ({ ...d, stages: sealed.rows }));

      if (sealed.renumbered) {
        for (const stage of sealed.rows) void sync.moveStage(stage.id, stage.fractionalIndex!);
      } else {
        void sync.moveStage(activeId, sealed.rows[to].fractionalIndex!);
      }
    },
    [doc.stages, sync],
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
      const stage = doc.stages.find((s) => s.id === stageId);
      void sync.renameStage({ id: stageId, name, fractionalIndex: stage?.fractionalIndex });
    },
    [doc.stages, patchStage, sync],
  );

  /**
   * 段を消す。中の参考書も一緒に消える。最後の1段は残す。
   *
   * **サーバーへの削除だけを数秒遅らせる**（ロードマップや参考書の削除と同じ作り）。
   * 確認を二重にするより、まず実行して戻せる方がこの設計と揃う（画面設計 09）。
   * 段は中の本ごと消えるので、確認だけでは事故ったときに取り返しがつかない。
   */
  const removeStage = useCallback(
    (stageId: string) => {
      if (doc.stages.length <= 1) return;
      const index = doc.stages.findIndex((s) => s.id === stageId);
      const stage = doc.stages[index];
      if (!stage) return;

      setStageMenuId(null);
      setDoc((d) => ({ ...d, stages: d.stages.filter((s) => s.id !== stageId) }));
      setRemovedStage({ stage, index });

      const flush = () => void sync.removeStage(stageId);
      const timer = setTimeout(() => {
        pendingStageRemove.current = null;
        setRemovedStage(null);
        flush();
      }, 8000);
      pendingStageRemove.current = { flush, timer };
    },
    [doc.stages, sync],
  );

  const undoRemoveStage = useCallback(() => {
    if (pendingStageRemove.current) {
      clearTimeout(pendingStageRemove.current.timer);
      pendingStageRemove.current = null;
    }
    if (removedStage) {
      // サーバーへの削除はまだ走っていないので、手元に戻すだけでよい
      setDoc((d) => {
        const next = [...d.stages];
        next.splice(Math.min(removedStage.index, next.length), 0, removedStage.stage);
        return { ...d, stages: next };
      });
    }
    setRemovedStage(null);
  }, [removedStage]);

  const detail = detailId ? findItem(detailId) : null;
  const detailBook = detail ? (books[detail.item.bookId] ?? null) : null;
  const stageMenu = stageMenuId ? doc.stages.find((s) => s.id === stageMenuId) : null;
  const present = useMemo(() => new Set(items.map((i) => i.bookId)), [items]);

  return (
    <div data-touch-surface className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-1.5 px-3 pb-1 pt-2 md:px-5">
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

      <div className="px-4 pb-1 pt-1 md:px-6">
        <h1 className="mb-1">
          <textarea
            ref={titleRef}
            value={doc.title}
            onChange={(e) => changeTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={onTitleKeyDown}
            rows={1}
            /*
              **上限を付ける。** 名前は一覧・共有ページの見出し・OGP画像・
              ブラウザのタブに出る。長いと全部で折れたり切れたりするし、
              OGPは40字で切っているので、そこに合わせて入力段階で止める。
            */
            maxLength={TITLE_MAX}
            placeholder={UNTITLED}
            aria-label="ロードマップの名前"
            /* 太字にしない。大きさで見出しらしさは足りるし、太いと紙の上で重く出る */
            className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[1.45rem] font-semibold leading-[1.35] tracking-[-0.005em] text-ink-title text-balance outline-none placeholder:font-normal placeholder:text-ink-faint md:text-[1.75rem]"
          />
        </h1>

        {doc.copiedFrom && (
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.73rem] text-ink-faint">
            <span>
              {doc.copiedFrom.authorName
                ? `${doc.copiedFrom.authorName}さんのロードマップをもとにしています`
                : "他の人のロードマップをもとにしています"}
            </span>
            {/*
              **リンクは `shareSlug`。`roadmapId` ではない。**
              共有ページは share_slug で引くので、id を入れると必ず外れる。
              元が消えた／非公開に戻ったときは slug が null になり、
              リンクだけが消えて「もとにしています」の表示は残る（6章）。
            */}
            {doc.copiedFrom.shareSlug && (
              <a
                href={`/r/${doc.copiedFrom.shareSlug}`}
                className="flex-none text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                元を見る
              </a>
            )}
          </div>
        )}

      </div>

      <div className="flex-1 pb-16 pt-3">
        {/*
          **読み込み中に空の棚を出さない。** 参考書は IndexedDB から読むので
          一瞬かかる。その間に空の棚が見えると「消えた」と読めてしまう。
        */}
        {!hydrated ? (
          <div className="flex items-center justify-center gap-2.5 py-16 text-ink-faint">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-rule-strong border-t-thread"
            />
            <span className="text-[0.82rem]">読み込んでいます…</span>
          </div>
        ) : (
        <List
          stages={doc.stages}
          books={books}
          onToggleStage={toggleStage}
          onRenameStage={renameStage}
          onOpenItem={setDetailId}
          onAddBook={setAddingTo}
          onOpenStageMenu={setStageMenuId}
          onMoveItem={moveItem}
          onReorderStages={reorderStages}
        />
        )}

        <div className="h-5 md:h-7" />

        {/* 段を追加 */}
        {hydrated && (
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
              className="w-full rounded-xl border-2 border-dashed border-rule-strong px-3.5 py-3 text-left text-[0.9rem] font-bold text-ink-soft transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-strong"
            >
              ＋ 段を追加
            </button>
          </div>
          <div className="h-4" />
        </section>
        )}

        {/* GOAL */}
        <section className="relative pl-[46px]">
          <span className="absolute left-[15px] top-0 flex h-8 w-[22px] justify-center">
            <span aria-hidden="true" className="absolute top-0 h-2.5 w-[3px] rounded-sm bg-thread opacity-[0.28]" />
            <span className="relative z-[2] mt-0.5 grid h-6 w-6 place-items-center self-start rounded-full bg-thread text-white shadow-[0_0_0_4px_var(--raised)]">
              <FlagIcon size={12} />
            </span>
          </span>
          <div className="pt-0.5">
            <span className="block font-mono text-[0.68rem] tracking-[0.16em] text-ink-faint">
              GOAL
            </span>
            {/*
              **目標は本人に書かせる。** タイトルは「英語」のような分野名になりやすく、
              到達点とは別物。ここは進めているあいだ見続けるための文なので、
              紐と同じ色を当てて経路の終わりだと分かるようにする。
            */}
            <textarea
              ref={goalRef}
              value={doc.goal}
              onChange={(e) => changeGoal(e.target.value)}
              onBlur={commitGoal}
              onKeyDown={onTitleKeyDown}
              rows={1}
              maxLength={60}
              placeholder="ここに目標を書く"
              aria-label="このロードマップの目標"
              className="mt-0.5 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[1.02rem] font-bold leading-[1.45] text-thread outline-none placeholder:font-semibold placeholder:text-ink-faint md:text-[1.15rem]"
            />
          </div>
        </section>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />

      <Toast
        message={
          removedStage
            ? removedStage.stage.items.length > 0
              ? `「${removedStage.stage.name || "名前のない段"}」と${removedStage.stage.items.length}冊を消した`
              : `「${removedStage.stage.name || "名前のない段"}」を消した`
            : null
        }
        onDismiss={() => setRemovedStage(null)}
        durationMs={8000}
        action={{ label: "取り消す", onClick: undoRemoveStage }}
      />

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
        onClose={() => setDetailId(null)}
        onPatch={patchItem}
        onToggleDone={toggleItemDone}
        onRemove={removeItem}
      />

      <Sheet
        open={stageMenu !== undefined && stageMenu !== null}
        onClose={() => {
          setStageMenuId(null);
          setConfirmingStageId(null);
        }}
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

            {doc.stages.length > 1 ? (
              <>
                <p className="text-[0.82rem] leading-relaxed text-ink-faint">
                  {stageMenu.items.length > 0
                    ? `中の${stageMenu.items.length}冊も一緒に消えます。消したあと数秒は取り消せます。`
                    : "消したあと数秒は取り消せます。"}
                </p>
                {/* 朱は最後の1つだけ（ドロワーの削除と同じ考え） */}
                {confirmingStageId === stageMenu.id ? (
                  <>
                    <p className="text-[0.84rem] text-ink-soft">本当に消しますか？</p>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingStageId(null);
                        removeStage(stageMenu.id);
                      }}
                      className="w-full rounded-[10px] bg-thread px-4 py-3 text-[0.88rem] font-bold text-white transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-thread"
                    >
                      消す
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingStageId(null)}
                      className="w-full py-1.5 text-[0.82rem] text-ink-soft underline underline-offset-[3px] hover:text-ink"
                    >
                      やめる
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingStageId(stageMenu.id)}
                    className="w-full rounded-[10px] border border-rule-strong px-4 py-3 text-[0.88rem] text-ink-soft transition-colors hover:border-thread hover:text-thread focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-thread"
                  >
                    この段を消す
                  </button>
                )}
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
          // 先に動かして、書けなかったら戻す。嘘の状態を残さない
          setDoc((d) => ({ ...d, isPublic: next }));
          void sync.setPublic(next).then((ok) => {
            if (!ok) setDoc((d) => ({ ...d, isPublic: !next }));
          });
        }}
        shareSlug={doc.shareSlug}
        title={doc.title}
        bookCount={items.length}
      />
    </div>
  );
}
