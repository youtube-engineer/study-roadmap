"use client";

import { generateKeyBetween } from "fractional-indexing";

import { ensureSession, getBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Book, Roadmap, RoadmapItem } from "@/types/roadmap";

/**
 * 画面の操作を Supabase に反映する層。
 *
 * 画面の状態は編集画面がローカルに持っていて、ここは追いかけて書くだけ。
 * 失敗しても画面は巻き戻さない（CLAUDE.md 13章の「取り消し」が入るまでは、
 * 巻き戻す方が操作を失って分かりにくい）。
 *
 * Supabase が未設定なら全メソッドが何もしない。モックのまま動く。
 *
 * ※ Step 2 で IndexedDB を前に挟む。そのときこの層は「IndexedDB → Supabase の
 *    非同期同期」に位置づけが変わるが、呼び出し側の形は変えなくて済むようにしてある。
 */

type SyncOptions = {
  onError?: (message: string) => void;
};

export type RoadmapSync = ReturnType<typeof createRoadmapSync>;

export function createRoadmapSync(initial: Roadmap, options: SyncOptions = {}) {
  const roadmapId = initial.id;
  const shareSlug = initial.shareSlug;
  const title = initial.title;

  /** roadmaps の行を作ったか。最初の書き込みまで作らない */
  let ensured = initial.items.length > 0;
  let ensuring: Promise<boolean> | null = null;

  const fail = (where: string, error: unknown) => {
    console.error(`[sync] ${where}`, error);
    options.onError?.("保存できませんでした");
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

  return {
    /** 並び順のキーを作る。前後の行の間に挟むので、動かした行だけ更新すれば済む */
    keyBetween(before: RoadmapItem | undefined, after: RoadmapItem | undefined): string {
      try {
        return generateKeyBetween(before?.fractionalIndex ?? null, after?.fractionalIndex ?? null);
      } catch {
        // 前後が壊れている（同じキーが並んでいる等）ときの逃げ道
        return generateKeyBetween(null, null);
      }
    },

    async addItem(item: RoadmapItem, book: Book): Promise<void> {
      const supabase = getBrowserClient();
      if (!supabase) return;
      if (!(await ensureRoadmap())) return;

      const bookId = await persistBook(book);
      if (!bookId) return;

      const { error } = await supabase.from("roadmap_items").insert({
        id: item.id,
        roadmap_id: roadmapId,
        book_id: bookId,
        fractional_index: item.fractionalIndex ?? generateKeyBetween(null, null),
        is_done: item.isDone,
        rounds_target: item.roundsTarget,
        note: item.note,
      });

      if (error) fail("addItem", error);
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
