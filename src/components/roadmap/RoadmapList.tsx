"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { listLocal, saveLocal } from "@/lib/db/local";
import { newRoadmap } from "@/lib/roadmaps/create";
import type { RoadmapSummary } from "@/types/roadmap";

type Props = {
  /** サーバー（Supabase）にあるぶん。ログイン前や未接続なら空 */
  serverSummaries: RoadmapSummary[];
};

/**
 * 自分のルート一覧。
 *
 * **サーバーとローカルを突き合わせて出す。** 同じ id があればローカルを採る
 * （操作のたびに書いているのでローカルの方が新しい）。ローカルにしか無いもの
 * ——ログインする前に作ったもの——も並ぶ。
 *
 * ネットワークを待たずに出せるのがこの層を持つ理由（CLAUDE.md 10章）。
 */
export function RoadmapList({ serverSummaries }: Props) {
  const router = useRouter();
  const [summaries, setSummaries] = useState<RoadmapSummary[]>(serverSummaries);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    listLocal().then((local) => {
      if (!alive) return;
      const byId = new Map(serverSummaries.map((s) => [s.id, s]));
      for (const s of local) byId.set(s.id, s); // 同じidならローカルが勝つ
      // createdAt は移行で埋めているが、読み出したものが壊れていても
      // 一覧ごと落とさない
      setSummaries(
        [...byId.values()].sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        ),
      );
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [serverSummaries]);

  const create = async () => {
    const roadmap = newRoadmap();
    await saveLocal({ roadmap, books: [] });
    router.push(`/roadmaps/${roadmap.id}`);
  };

  return (
    <div data-touch-surface className="flex min-h-dvh flex-col px-4 pb-10 pt-6">
      <h1 className="mb-1 font-serif text-[1.36rem] font-semibold leading-[1.42]">
        自分のルート
      </h1>
      <p className="mb-5 text-[0.78rem] text-ink-faint">
        参考書をどの順番で進めるかを、1本の経路として組み立てます。
      </p>

      {summaries.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-rule-strong px-5 py-10 text-center">
          <p className="mb-1 text-[0.9rem] text-ink-soft">まだ1本もありません</p>
          <p className="text-[0.78rem] leading-relaxed text-ink-faint">
            {ready
              ? "1冊目を置くところから始められます。ログインは要りません。"
              : "読み込んでいます…"}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {summaries.map((s) => (
            <li key={s.id}>
              <Link
                href={`/roadmaps/${s.id}`}
                className="block rounded-[12px] border border-rule bg-sunk px-4 py-3.5 transition-colors hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 font-serif text-[1.02rem] font-semibold leading-snug">
                    {s.title}
                  </span>
                  {s.isPublic && (
                    <span className="mt-0.5 flex-none rounded-full bg-accent-soft px-2 py-[0.1em] text-[0.68rem] text-accent-strong">
                      公開中
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-2.5">
                  <span className="flex-1">
                    {s.tags.map((tag) => (
                      <span
                        key={tag}
                        className="mr-1.5 rounded-full bg-accent-soft px-2 py-[0.1em] text-[0.7rem] text-accent-strong"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="flex-none font-mono text-[0.66rem] text-ink-faint">
                    {s.totalCount === 0
                      ? "まだ空"
                      : `${s.doneCount}/${s.totalCount} 終了`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={create}
        className="mt-4 w-full rounded-[10px] bg-accent px-4 py-3 text-[0.92rem] font-medium text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        新しいルートを作る
      </button>
    </div>
  );
}
