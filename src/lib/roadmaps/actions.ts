"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";

import { copyRoadmapForCurrentUser } from "./copy";
import { copyRoadmap } from "./mock-store";

/** 失敗したときだけ中身が入る。成功したときは redirect で戻らない */
export type CopyResult = { error?: string };

/**
 * 共有ページからの複製。
 *
 * サーバー側でやる必要がある。元のロードマップを読むのも、新しい所有者のもとに
 * 作り直すのもサーバーの仕事だから。作った先の編集画面へ送る。
 *
 * ★ **失敗したら黙って入口へ送らない。** 以前は `redirect("/")` にしていたが、
 * 入口は最後に触ったロードマップへ送る作りなので、**押す前と同じ画面に戻る
 * ように見える**——「押しても反応がない」としか読めない。
 * 元が非公開に戻っていた、消えていた、というのは正当に起きること（6章）なので、
 * 何が起きたかをその場に出す。
 */
export async function copyRoadmapAction(
  _prev: CopyResult,
  formData: FormData,
): Promise<CopyResult> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "コピー元が分かりませんでした。ページを開き直してください" };

  const newId = isSupabaseConfigured()
    ? await copyRoadmapForCurrentUser(slug)
    : ((await copyRoadmap(slug))?.id ?? null);

  if (!newId) {
    return {
      error:
        "コピーできませんでした。元のロードマップが非公開に戻されたか、削除された可能性があります",
    };
  }

  revalidatePath("/");

  // redirect は例外を投げて抜けるので、ここから先は戻らない
  redirect(`/roadmaps/${newId}`);
}
