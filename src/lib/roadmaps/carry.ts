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
 *
 * **何度呼ばれても増えないこと。** IndexedDB は消えずに残り続けるので、
 * ログインのたびにここを通る。「サーバーに自分のものとして既にあるか」を
 * 見ずに入れると、ログインするたびに同じルートが増えていく。
 */

/** 手元の id は uuid のはずだが、古い形が残っていると in() クエリが落ちる */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

export type CarryResult = {
  /** 持ち込んだ本数 */
  carried: number;
  /** 元のid → 新しいid。持ち込みでidが変わるので、開いていた画面を追う手がかりになる */
  moved: Map<string, string>;
};

export async function carryLocalRoadmapsToCurrentUser(): Promise<CarryResult> {
  const empty: CarryResult = { carried: 0, moved: new Map() };
  const supabase = getBrowserClient();
  if (!supabase) return empty;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const summaries = await listLocal();
  if (summaries.length === 0) return empty;

  /**
   * 既に自分のものとしてサーバーにあるぶんは持ち込まない。
   *
   * 持ち込んだ後、手元の文書は新しい id で保存し直される。その id は
   * 自分の所有になっているので、次にここを通ったときは弾かれる。これで
   * 何度ログインしても増えない。
   *
   * 所有者まで見るのは、公開されている他人のロードマップが RLS 越しに
   * 見えることがあるため。「見える＝自分のもの」ではない。
   */
  const candidateIds = summaries.map((s) => s.id).filter((id) => UUID.test(id));
  const alreadyMine = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: existing } = await supabase
      .from("roadmaps")
      .select("id, owner_id")
      .in("id", candidateIds);
    for (const row of existing ?? []) {
      if (row.owner_id === user.id) alreadyMine.add(row.id);
    }
  }

  let carried = 0;
  const moved = new Map<string, string>();

  for (const summary of summaries) {
    if (alreadyMine.has(summary.id)) continue;

    const local = await loadLocalRoadmap(summary.id);
    if (!local) continue;

    // books は誰のものでもないので、載っていなければ載せてidを得る
    const bookIds = new Map<string, string>();
    let bookFailed = false;
    for (const book of local.books) {
      const id = await persistBook(book);
      if (id) bookIds.set(book.id, id);
      else bookFailed = true;
    }

    /**
     * **1冊でも載せられなかったら、このロードマップは持ち込まない。**
     *
     * 以前は載せられなかったぶんを黙って捨てていた。その結果、
     * 中身が抜けたロードマップがアカウント側にできて「タイトルは同じなのに
     * 並びが違う」状態になった。半端に運ぶより、運ばない方がいい。
     * 手元には残るし、この処理は冪等なので次のログインでやり直される。
     */
    if (bookFailed) {
      console.error("[carry] 本を載せられなかったので見送った", summary.title);
      continue;
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
        // 上で全冊ぶん揃っていることを確かめてあるので、ここには来ない
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
    moved.set(local.roadmap.id, newId);
    carried += 1;
  }

  return { carried, moved };
}
