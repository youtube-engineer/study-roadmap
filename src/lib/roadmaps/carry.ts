"use client";

import { deleteLocalRoadmap, listLocal, loadLocalRoadmap, saveLocal } from "@/lib/db/local";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Book } from "@/types/roadmap";

import { newShareSlug } from "./slug";

/**
 * この端末に残っている作りかけを、今ログインしているアカウントのものとして作り直す。
 *
 * 昇格（linkIdentity）が「既に別のユーザーに紐づいている」で失敗し、
 * ユーザーが既存アカウントへ入ることを選んだときに走る。
 *
 * **合体ではない。** 元々アカウントにあったロードマップには一切触れず、
 * 持ち込んだぶんが別のロードマップとして増えるだけ。どちらも消えない。
 *
 * やっていることは copy.ts と同じ（新しい所有者のもとに作り直す）。
 * 違うのは、元がサーバーではなく手元の IndexedDB だという点だけ。
 */
async function persistBook(book: Book): Promise<string | null> {
  try {
    const res = await fetch("/api/books/persist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { id: string | null }).id;
  } catch {
    return null;
  }
}

export async function carryLocalRoadmapsToCurrentUser(): Promise<number> {
  const supabase = getBrowserClient();
  if (!supabase) return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const summaries = await listLocal();
  let carried = 0;

  for (const summary of summaries) {
    const local = await loadLocalRoadmap(summary.id);
    if (!local) continue;

    // books は誰のものでもないので、載っていなければ載せてidを得る
    const bookIds = new Map<string, string>();
    for (const book of local.books) {
      const id = await persistBook(book);
      if (id) bookIds.set(book.id, id);
    }

    const newId = crypto.randomUUID();
    const { error } = await supabase.from("roadmaps").insert({
      id: newId,
      owner_id: user.id,
      title: local.roadmap.title,
      share_slug: newShareSlug(),
      // 持ち込んだものは非公開から始める。元の公開状態を引き継がない
      is_public: false,
    });
    if (error) {
      console.error("[carry] roadmaps", error);
      continue;
    }

    const rows = local.roadmap.items
      .map((item, index) => {
        const bookId = bookIds.get(item.bookId);
        if (!bookId) return null;
        return {
          roadmap_id: newId,
          book_id: bookId,
          fractional_index: item.fractionalIndex ?? `a${index}`,
          // 進捗は自分のものなので、こちらは引き継ぐ（他人のコピーとは違う）
          is_done: item.isDone,
          rounds_target: item.roundsTarget,
          note: item.note,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from("roadmap_items").insert(rows);
      if (itemsError) console.error("[carry] roadmap_items", itemsError);
    }

    // 手元も新しいidに置き換える。古い方は誰からも辿れなくなるので消す
    await saveLocal({
      roadmap: {
        ...local.roadmap,
        id: newId,
        shareSlug: newShareSlug(),
        isPublic: false,
        createdAt: new Date().toISOString(),
      },
      books: local.books,
    });
    await deleteLocalRoadmap(local.roadmap.id);
    carried += 1;
  }

  return carried;
}
