"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";

import { copyRoadmapForCurrentUser } from "./copy";
import { copyRoadmap, startBlankRoadmap } from "./mock-store";

export async function copyRoadmapAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");

  if (isSupabaseConfigured()) {
    await copyRoadmapForCurrentUser(slug);
  } else {
    await copyRoadmap(slug);
  }

  revalidatePath("/");
  redirect("/");
}

export async function startBlankAction() {
  // Supabase を使う場合、まっさらな状態は保存しない。
  // 最初の1冊を追加した時点で roadmaps の行ができる（sync.ts）
  if (!isSupabaseConfigured()) {
    await startBlankRoadmap();
  }

  revalidatePath("/");
  redirect("/");
}
