"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { listLocal } from "@/lib/db/local";
import type { RoadmapSummary } from "@/types/roadmap";

/**
 * 入口。最後に触ったルートを開く。1本も無ければ空のルートを開く。
 *
 * 一覧を独立したページに置かず、ここから直接ルートへ入る。切り替えは
 * 編集画面のドロワーが担うので、間に一覧を挟むと寄り道が1つ増えるだけになる。
 *
 * どれを開くかは IndexedDB を読まないと決まらないので、サーバーでは
 * 決められない。サーバーが持っているぶんも渡してもらって突き合わせる。
 */
export function HomeEntry({ serverSummaries }: { serverSummaries: RoadmapSummary[] }) {
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    listLocal().then((local) => {
      if (!alive) return;

      const byId = new Map(serverSummaries.map((s) => [s.id, s]));
      for (const s of local) byId.set(s.id, s);

      const recent = [...byId.values()].sort((a, b) =>
        (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""),
      )[0];

      // 何も無い人には空のルートを開く。ここでは保存しない——
      // 開いただけで何もしなかったぶんが一覧に溜まらないようにするため
      router.replace(`/roadmaps/${recent ? recent.id : crypto.randomUUID()}`);
    });

    return () => {
      alive = false;
    };
  }, [router, serverSummaries]);

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <p className="font-mono text-[0.7rem] tracking-[0.12em] text-ink-faint">START</p>
    </div>
  );
}
