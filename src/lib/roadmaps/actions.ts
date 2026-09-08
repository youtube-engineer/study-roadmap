"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";

import { copyRoadmapForCurrentUser } from "./copy";
import { copyRoadmap } from "./mock-store";

/**
 * 共有ページからの複製。
 *
 * サーバー側でやる必要がある。元のロードマップを読むのも、新しい所有者のもとに
 * 作り直すのもサーバーの仕事だから。作った先の編集画面へ送る。
 */
export async function copyRoadmapAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  let newId: string | null = null;
  if (isSupabaseConfigured()) {
    newId = await copyRoadmapForCurrentUser(slug);
  } else {
    newId = (await copyRoadmap(slug))?.id ?? null;
  }

  revalidatePath("/");
  redirect(newId ? `/roadmaps/${newId}` : "/");
}
