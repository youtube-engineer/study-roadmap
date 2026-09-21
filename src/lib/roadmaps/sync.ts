"use client";

import { generateKeyBetween } from "fractional-indexing";

import { ensureSession, getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Book, Roadmap, RoadmapItem } from "@/types/roadmap";

/**
 * 操作を Supabase に送る層。**保存の主役ではない。**
 *
 * 即時の保存は IndexedDB（`lib/db/local.ts`）が担当していて、ここはその裏で
 * 送るだけ。ネットワークが遅くても画面の操作は止まらない（CLAUDE.md 5章）。
 * 失敗しても画面は巻き戻さない。IndexedDB には書けているので操作は失われない。
 *
 * Supabase が未設定なら全メソッドが何もしない。IndexedDB だけで完結する。
 */

type SyncOptions = {
  onError?: (message: string) => void;
};

/** ロードマップを特定するための最小限。中身（items）も名前もここでは持たない */
export type SyncTarget = Pick<Roadmap, "id" | "shareSlug">;

export type RoadmapSync = ReturnType<typeof createRoadmapSync>;

export function createRoadmapSync(target: SyncTarget, options: SyncOptions = {}) {
  const { id: roadmapId, shareSlug } = target;

  /**
   * roadmaps の行を作るときに使う名前。
   *
   * 行が作られるのは最初の書き込みの瞬間で、そこまでに名前が変わっている
   * ことがある。編集画面が rememberTitle で最新の値を預けておく。
   *
   * 名前を付けずに1冊置いた場合は空のまま入る。表示側で「無題のルート」を補う。
   */
  let title = "";

  /**
   * roadmaps の行を用意したか。セッション内で1回だけ走らせる。
   * upsert は ignoreDuplicates なので、既にある行に対して呼んでも無害
   */
  let ensured = false;
  let ensuring: Promise<boolean> | null = null;

  /** 同じ知らせを何度も出さない。1回の操作で複数の書き込みが走るため */
  let warned = false;

  const fail = (where: string, error: unknown) => {
    /**
     * **Supabase のエラーはそのまま渡すと `{}` としか出ない。**
     * プロトタイプに乗っていないプレーンオブジェクトなので、console が
     * 展開してくれない。必要なものを取り出して文字列にする。
     */
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(
      `[sync] ${where}: ${e?.message ?? String(error)}`,
      e?.code ? `code=${e.code}` : "",
      e?.details ?? "",
      e?.hint ?? "",
    );

    /**
     * **「保存できませんでした」とは言わない。** IndexedDB には書けていて、
     * 失敗したのは裏の同期だけ（5章。ローカルが主、Supabaseが従）。
     * 操作は失われていないので、そう伝える。
     */
    if (!warned) {
      warned = true;
      options.onError?.("同期できませんでした。この端末には保存されています");
    }
    return false;
  };

  /**
   * 匿名サインインと roadmaps の行の用意。
   * **最初の書き込みで初めて走る。** 訪問しただけの人にユーザーを作らない
   */
  async function ensureRoadmap(): Promise<boolean> {
    const supabase = getBrowserClient();
    if (!supabase) return false;
    if (ensured) return true;
    if (ensuring) return ensuring;

    ensuring = (async () => {
      const userId = await ensureSession();
      if (!userId) return false;

      const { error } = await supabase
        .from("roadmaps")
        .upsert(
          {
            id: roadmapId,
            owner_id: userId,
            title,
            share_slug: shareSlug,
            is_public: false,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );

      if (error) return fail("ensureRoadmap", error);
      ensured = true;
      return true;
    })();

    const result = await ensuring;
    ensuring = null;
    return result;
  }

  /** 検索で選ばれた本を books に載せて、その id を得る */
  async function persistBook(book: Book): Promise<string | null> {
    try {
      const res = await fetch("/api/books/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id: string | null };
      return data.id;
    } catch (e) {
      fail("persistBook", e);
      return null;
    }
  }

  /**
   * 段を用意する。
   *
   * **`upsert` にしているのは、最初の段がサーバーに無いまま参考書を入れようとして
   * 外部キーで落ちるのを防ぐため。** 新しいロードマップの1段目は画面側で
   * 作られるだけで、ここを通っていない。
   */
  async function ensureStage(stage: {
    id: string;
    name: string;
    fractionalIndex?: string;
  }): Promise<void> {
    const supabase = getBrowserClient();
    if (!supabase) return;
    if (!(await ensureRoadmap())) return;

    const { error } = await supabase.from("roadmap_stages").upsert(
      {
        id: stage.id,
        roadmap_id: roadmapId,
        name: stage.name,
        fractional_index: stage.fractionalIndex ?? generateKeyBetween(null, null),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) fail("ensureStage", error);
  }

  return {
    /** どのロードマップ用に作られたものか。編集画面が作り直しの要否を判断する */
    roadmapId,

    /** 並び順のキーを作る。前後の行の間に挟むので、動かした行だけ更新すれば済む */
    keyBetween(before: RoadmapItem | undefined, after: RoadmapItem | undefined): string {
      try {
        return generateKeyBetween(before?.fractionalIndex ?? null, after?.fractionalIndex ?? null);
      } catch {
        // 前後が壊れている（同じキーが並んでいる等）ときの逃げ道
        return generateKeyBetween(null, null);
      }
    },

    addStage: ensureStage,

    async renameStage(stageId: string, name: string): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase) return;
      if (!(await ensureRoadmap())) return;

      const { error } = await supabase
        .from("roadmap_stages")
        .update({ name })
        .eq("id", stageId);
      if (error) fail("renameStage", error);
    },

    /** 段の並び順。動かした段だけ更新すれば済む */
    async moveStage(stageId: string, fractionalIndex: string): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase || !ensured) return;

      const { error } = await supabase
        .from("roadmap_stages")
        .update({ fractional_index: fractionalIndex })
        .eq("id", stageId);
      if (error) fail("moveStage", error);
    },

    /** 段を消すと中の参考書も消える（on delete cascade） */
    async removeStage(stageId: string): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase || !ensured) return;

      const { error } = await supabase.from("roadmap_stages").delete().eq("id", stageId);
      if (error) fail("removeStage", error);
    },

    async addItem(
      item: RoadmapItem,
      book: Book,
      stage: { id: string; name: string; fractionalIndex?: string },
    ): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase) return;
      if (!(await ensureRoadmap())) return;

      // 段がまだサーバーに無いことがある（新しいロードマップの1段目）
      await ensureStage(stage);

      const bookId = await persistBook(book);
      if (!bookId) return;

      const { error } = await supabase.from("roadmap_items").insert({
        id: item.id,
        roadmap_id: roadmapId,
        stage_id: stage.id,
        book_id: bookId,
        fractional_index: item.fractionalIndex ?? generateKeyBetween(null, null),
        is_done: item.isDone,
        rounds_target: item.roundsTarget,
        note: item.note,
      });

      if (error) fail("addItem", error);
    },

    /** 別の段へ移す。並び順のキーも一緒に打ち替える */
    async moveItem(itemId: string, stageId: string, fractionalIndex: string): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase || !ensured) return;

      const { error } = await supabase
        .from("roadmap_items")
        .update({ stage_id: stageId, fractional_index: fractionalIndex })
        .eq("id", itemId);
      if (error) fail("moveItem", error);
    },

    async patchItem(itemId: string, patch: Partial<RoadmapItem>): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase || !ensured) return;

      const row: Database["public"]["Tables"]["roadmap_items"]["Update"] = {};
      if (patch.isDone !== undefined) row.is_done = patch.isDone;
      if (patch.roundsTarget !== undefined) row.rounds_target = patch.roundsTarget;
      if (patch.note !== undefined) row.note = patch.note;
      if (patch.fractionalIndex !== undefined) row.fractional_index = patch.fractionalIndex;
      if (Object.keys(row).length === 0) return;

      const { error } = await supabase.from("roadmap_items").update(row).eq("id", itemId);
      if (error) fail("patchItem", error);
    },

    async removeItem(itemId: string): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase || !ensured) return;

      const { error } = await supabase.from("roadmap_items").delete().eq("id", itemId);
      if (error) fail("removeItem", error);
    },

    /**
     * ルートの名前。
     *
     * 打鍵のたびには送らない。ローカル（IndexedDB）は即時に書くが、こちらは
     * 入力欄から離れたときだけ呼ばれる。1文字ごとに update を投げても意味がない。
     */
    /**
     * 名前を覚えておくだけ。通信はしない。
     * まだ roadmaps の行が無い場合に、作る瞬間の名前として使われる
     */
    rememberTitle(next: string): void {
      title = next;
    },

    async setTitle(next: string): Promise<void> {
      title = next;

      const supabase = getBrowserClient();
      if (!supabase) return;
      if (!(await ensureRoadmap())) return;

      const { error } = await supabase
        .from("roadmaps")
        .update({ title: next })
        .eq("id", roadmapId);

      if (error) fail("setTitle", error);
    },

    async setPublic(isPublic: boolean): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase) return;
      if (!(await ensureRoadmap())) return;

      const { error } = await supabase
        .from("roadmaps")
        .update({ is_public: isPublic })
        .eq("id", roadmapId);

      if (error) fail("setPublic", error);
    },
  };
}
