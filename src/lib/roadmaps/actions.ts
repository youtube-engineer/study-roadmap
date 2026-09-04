"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";

import { copyRoadmapForCurrentUser, startBlankForCurrentUser } from "./copy";
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
  // 押した時点で実体を作る。作らないと、ローカルに残っている前のロードマップが
  // そのまま表示されてしまい「まっさらから作る」が効かない
  if (isSupabaseConfigured()) {
    await startBlankForCurrentUser();
  } else {
    await startBlankRoadmap();
  }

  revalidatePath("/");
  redirect("/");
}
