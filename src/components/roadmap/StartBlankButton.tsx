"use client";

import { useState } from "react";
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
  const [going, setGoing] = useState(false);

  const start = async () => {
    if (going) return;
    setGoing(true);
    const roadmap = newRoadmap();
    await saveLocal({ roadmap, books: [] });
    router.push(`/roadmaps/${roadmap.id}`);
  };

  /**
   * ★ **押したことが分かるようにする。** IndexedDB へ書いてから画面を移るので
   * 一拍かかる。変わらないと押せていないように見えて、二度押しされる。
   * 隣のコピーと同じ扱いにしておかないと、片方だけ無反応に見える。
   */
  return (
    <button type="button" onClick={start} disabled={going} className={className}>
      {going ? "ひらいています…" : "まっさらから作る"}
    </button>
  );
}
