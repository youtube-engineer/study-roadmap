"use client";

import { useRouter } from "next/navigation";

import { saveLocal } from "@/lib/db/local";
import { newRoadmap } from "@/lib/roadmaps/create";

/**
 * 「まっさらから作る」。
 *
 * サーバーには何も作らない。IndexedDB に置いて編集画面へ送るだけ。
 * 最初の1冊を置いた時点で初めて roadmaps の行ができる（CLAUDE.md 5章）。
 * 何も置かずに離脱した人のぶんまで匿名ユーザーを作らないため。
 */
export function StartBlankButton({ className }: { className?: string }) {
  const router = useRouter();

  const start = async () => {
    const roadmap = newRoadmap();
    await saveLocal({ roadmap, books: [] });
    router.push(`/roadmaps/${roadmap.id}`);
  };

  return (
    <button type="button" onClick={start} className={className}>
      まっさらから作る
    </button>
  );
}
