"use client";

import { getBrowserClient } from "@/lib/supabase/client";

/**
 * サーバー側の削除。
 *
 * roadmap_items は on delete cascade で一緒に消える（0001_init.sql）。
 * books は消さない。誰のものでもない表示用キャッシュで、他のロードマップが
 * 同じ本を指しているかもしれないため。
 *
 * **本人しか消せないことは RLS が保証する**ので、ここで所有者を確かめない
 * （CLAUDE.md 6章）。他人のIDを渡しても0行消えるだけ。
 */
export async function deleteRoadmapOnServer(id: string): Promise<void> {
  const supabase = getBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("roadmaps").delete().eq("id", id);
  if (error) console.error("[remove] roadmaps", error);
}
