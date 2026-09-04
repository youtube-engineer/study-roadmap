import "server-only";

import { hueFromTitle } from "@/lib/books/hue";
import { mockFindMany } from "@/lib/books/mock-source";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getServerClient } from "@/lib/supabase/server";
import type { Book, Roadmap, RoadmapItem } from "@/types/roadmap";

import { getOwnRoadmap as mockOwnRoadmap, getRoadmapBySlug as mockBySlug } from "./mock-store";
import { newShareSlug } from "./slug";

/**
 * ロードマップの読み取り。
 *
 * Supabase の鍵が入っていなければモックに落ちる。楽天APIと同じ扱い。
 *
 * どの行が見えるかは**RLSが決める**ので、ここに「本人かどうか」の判定は書かない
 * （CLAUDE.md 6章）。owner_id での絞り込みは権限の判定ではなく、
 * 「公開ロードマップまで返ってきてしまうので自分のものだけを選ぶ」という
 * 単なる選択であることに注意。
 */

/**
 * サーバーが渡してくるロードマップの出どころ。
 *
 * - stored      … 実際に保存されている文書。コピー直後や別端末からの読み込みがこれ
 * - placeholder … まだ何も無い人に見せるための仮の器。中身は空で、idも毎回変わる
 *
 * ローカル（IndexedDB）とどちらを採るかの判断に使う。placeholder は
 * 「サーバーには何も無い」という意味でしかないので、ローカルを上書きしてはいけない。
 */
export type RoadmapSource = "stored" | "placeholder";

export type LoadedRoadmap = { roadmap: Roadmap; books: Book[]; source: RoadmapSource };

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
    // books に出版年のカラムは無い（CLAUDE.md 6章のデータモデルどおり）。
    // 検索結果には出るが、保存後は持たない
    publishedYear: null,
    coverImageUrl: row.cover_image_url,
    sourceUrl: row.source_url,
    hue: hueFromTitle(row.title),
  };
}

/** まだ1つも作っていない人に見せる、保存されていないロードマップ */
export function blankRoadmap(): Roadmap {
  return {
    id: crypto.randomUUID(),
    title: "新しいルート",
    isPublic: false,
    shareSlug: newShareSlug(),
    tags: [],
    items: [],
    authorName: null,
    copiedFrom: null,
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

  // TODO: 生成した型を入れたら select("*, books(*)") の1クエリにまとめられる
  const { data: bookRows } = await supabase.from("books").select("*").in("id", bookIds);

  return { items, books: (bookRows ?? []).map(toBook) };
}

export async function loadOwnRoadmap(): Promise<LoadedRoadmap> {
  if (!isSupabaseConfigured()) {
    const roadmap = await mockOwnRoadmap();
    return {
      roadmap,
      books: mockFindMany(roadmap.items.map((i) => i.bookId)),
      source: "stored",
    };
  }

  const supabase = await getServerClient();
  if (!supabase) return { roadmap: blankRoadmap(), books: [], source: "placeholder" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // まだ匿名サインインもしていない＝一度も書き込んでいない人。
  // ここでセッションを作らないのが要点（訪問しただけでMAUに乗せない）
  if (!user) return { roadmap: blankRoadmap(), books: [], source: "placeholder" };

  const { data: row } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { roadmap: blankRoadmap(), books: [], source: "placeholder" };

  const { items, books } = await loadItemsAndBooks(row.id);

  return {
    roadmap: {
      id: row.id,
      title: row.title,
      isPublic: row.is_public,
      shareSlug: row.share_slug,
      tags: [],
      items,
      authorName: null,
      copiedFrom: row.copied_from_title
        ? {
            roadmapId: row.copied_from_id,
            title: row.copied_from_title,
            authorName: row.copied_from_name,
          }
        : null,
    },
    books,
    source: "stored",
  };
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

  return {
    roadmap: {
      id: row.id,
      title: row.title,
      isPublic: row.is_public,
      shareSlug: row.share_slug,
      tags: [],
      // 作成者名を出すにはログインが必要（CLAUDE.md 13章）。
      // まだプロフィールを持っていないので匿名のまま
      authorName: null,
      items,
      copiedFrom: row.copied_from_title
        ? {
            roadmapId: row.copied_from_id,
            title: row.copied_from_title,
            authorName: row.copied_from_name,
          }
        : null,
    },
    books,
    source: "stored",
  };
}
