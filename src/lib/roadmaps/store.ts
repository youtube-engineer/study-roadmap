import "server-only";

import { hueFromTitle } from "@/lib/books/hue";
import { mockFindMany } from "@/lib/books/mock-source";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getServerClient } from "@/lib/supabase/server";
import type { Book, Roadmap, RoadmapItem, RoadmapSummary } from "@/types/roadmap";

import {
  getOwnRoadmap as mockOwnRoadmap,
  getRoadmapBySlug as mockBySlug,
} from "./mock-store";
import { newShareSlug } from "./slug";

/**
 * ロードマップの読み取り。
 *
 * Supabase の鍵が入っていなければモックに落ちる。
 *
 * どの行が見えるかは**RLSが決める**ので、ここに「本人かどうか」の判定は書かない
 * （CLAUDE.md 6章）。owner_id での絞り込みは権限の判定ではなく、
 * 「公開ロードマップまで返ってきてしまうので自分のものだけを選ぶ」という
 * 単なる選択であることに注意。
 */

/**
 * サーバーが渡してくるロードマップの出どころ。
 *
 * - stored      … 実際に保存されている文書
 * - placeholder … サーバーには無い。手元にしか無いか、まだ何も無い
 *
 * ローカル（IndexedDB）とどちらを採るかの判断に使う。placeholder は
 * 「サーバーには何も無い」という意味でしかないので、ローカルを上書きしてはいけない。
 */
export type RoadmapSource = "stored" | "placeholder";

export type LoadedRoadmap = { roadmap: Roadmap; books: Book[]; source: RoadmapSource };

type RoadmapRow = {
  id: string;
  title: string;
  is_public: boolean;
  share_slug: string;
  copied_from_id: string | null;
  copied_from_title: string | null;
  copied_from_name: string | null;
  created_at: string;
};

type BookRow = {
  id: string;
  isbn: string | null;
  source: "rakuten" | "openbd" | "manual";
  title: string;
  author: string | null;
  cover_image_url: string | null;
  source_url: string | null;
};

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    isbn: row.isbn,
    source: row.source,
    title: row.title,
    author: row.author ?? "",
    // books に出版年のカラムは無い（CLAUDE.md 6章のデータモデルどおり）
    publishedYear: null,
    coverImageUrl: row.cover_image_url,
    sourceUrl: row.source_url,
    hue: hueFromTitle(row.title),
  };
}

function toRoadmap(row: RoadmapRow, items: RoadmapItem[]): Roadmap {
  return {
    id: row.id,
    title: row.title,
    isPublic: row.is_public,
    shareSlug: row.share_slug,
    tags: [],
    items,
    // 作成者名を出すにはログインが必要（CLAUDE.md 13章）
    authorName: null,
    createdAt: row.created_at,
    copiedFrom: row.copied_from_title
      ? {
          roadmapId: row.copied_from_id,
          title: row.copied_from_title,
          authorName: row.copied_from_name,
        }
      : null,
  };
}

/** サーバーに存在しないものを開いたときの器。中身はローカルが埋める */
export function placeholderRoadmap(id: string): Roadmap {
  return {
    id,
    title: "新しいルート",
    isPublic: false,
    shareSlug: newShareSlug(),
    tags: [],
    items: [],
    authorName: null,
    copiedFrom: null,
    createdAt: new Date().toISOString(),
  };
}

async function loadItemsAndBooks(
  roadmapId: string,
): Promise<{ items: RoadmapItem[]; books: Book[] }> {
  const supabase = await getServerClient();
  if (!supabase) return { items: [], books: [] };

  const { data: itemRows, error } = await supabase
    .from("roadmap_items")
    .select("*")
    .eq("roadmap_id", roadmapId)
    .order("fractional_index", { ascending: true });

  if (error || !itemRows) {
    console.error("[roadmaps/store] items", error);
    return { items: [], books: [] };
  }

  const items: RoadmapItem[] = itemRows.map((row) => ({
    id: row.id,
    bookId: row.book_id,
    isDone: row.is_done,
    roundsTarget: row.rounds_target,
    note: row.note,
    fractionalIndex: row.fractional_index,
  }));

  const bookIds = [...new Set(items.map((i) => i.bookId))];
  if (bookIds.length === 0) return { items, books: [] };

  const { data: bookRows } = await supabase.from("books").select("*").in("id", bookIds);
  return { items, books: (bookRows ?? []).map(toBook) };
}

/**
 * 一覧。**サーバーにあるぶんだけ**を返す。
 *
 * 手元にしか無いもの（ログイン前に作ったもの）は IndexedDB 側にあるので、
 * 画面側で突き合わせる。ここでネットワークを待たせないのが 10章の狙い。
 */
export async function loadOwnSummaries(): Promise<RoadmapSummary[]> {
  if (!isSupabaseConfigured()) {
    const roadmap = await mockOwnRoadmap();
    return [
      {
        id: roadmap.id,
        title: roadmap.title,
        tags: roadmap.tags,
        isPublic: roadmap.isPublic,
        shareSlug: roadmap.shareSlug,
        totalCount: roadmap.items.length,
        doneCount: roadmap.items.filter((i) => i.isDone).length,
        createdAt: roadmap.createdAt,
      },
    ];
  }

  const supabase = await getServerClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // まだ一度も書き込んでいない人。ここでセッションを作らない
  if (!user) return [];

  const { data: rows } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  // 冊数と進捗のためだけに items を引く。中身（note等）は開くまで読まない
  const { data: itemRows } = await supabase
    .from("roadmap_items")
    .select("roadmap_id, is_done")
    .in(
      "roadmap_id",
      rows.map((r) => r.id),
    );

  return rows.map((row) => {
    const mine = (itemRows ?? []).filter((i) => i.roadmap_id === row.id);
    return {
      id: row.id,
      title: row.title,
      tags: [],
      isPublic: row.is_public,
      shareSlug: row.share_slug,
      totalCount: mine.length,
      doneCount: mine.filter((i) => i.is_done).length,
      createdAt: row.created_at,
    };
  });
}

/** 1本ぶん。サーバーに無ければ placeholder を返す（手元にしか無い場合） */
export async function loadRoadmap(id: string): Promise<LoadedRoadmap> {
  if (!isSupabaseConfigured()) {
    const roadmap = await mockOwnRoadmap();
    if (roadmap.id === id) {
      return {
        roadmap,
        books: mockFindMany(roadmap.items.map((i) => i.bookId)),
        source: "stored",
      };
    }
    return { roadmap: placeholderRoadmap(id), books: [], source: "placeholder" };
  }

  const supabase = await getServerClient();
  if (!supabase) return { roadmap: placeholderRoadmap(id), books: [], source: "placeholder" };

  const { data: row } = await supabase.from("roadmaps").select("*").eq("id", id).maybeSingle();
  if (!row) return { roadmap: placeholderRoadmap(id), books: [], source: "placeholder" };

  const { items, books } = await loadItemsAndBooks(row.id);
  return { roadmap: toRoadmap(row, items), books, source: "stored" };
}

export async function loadSharedRoadmap(slug: string): Promise<LoadedRoadmap | null> {
  if (!isSupabaseConfigured()) {
    const roadmap = await mockBySlug(slug);
    if (!roadmap) return null;
    return {
      roadmap,
      books: mockFindMany(roadmap.items.map((i) => i.bookId)),
      source: "stored",
    };
  }

  const supabase = await getServerClient();
  if (!supabase) return null;

  // is_public = false の行は RLS が弾くので、ここで is_public を条件に書かない。
  // アプリ側とRLSの両方に同じ判定を置くと、片方を直したときにもう片方が残る
  const { data: row } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!row) return null;

  const { items, books } = await loadItemsAndBooks(row.id);
  return { roadmap: toRoadmap(row, items), books, source: "stored" };
}
