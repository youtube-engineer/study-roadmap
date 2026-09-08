"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CARRY_FLAG, LoginButton } from "@/components/auth/LoginButton";
import { Sheet } from "@/components/sheets/Sheet";
import { Toast } from "@/components/ui/Toast";
import {
  deleteLocalRoadmap,
  listLocal,
  loadLocalRoadmap,
  saveLocal,
  type LocalSnapshot,
} from "@/lib/db/local";
import { carryLocalRoadmapsToCurrentUser } from "@/lib/roadmaps/carry";
import { deleteRoadmapOnServer } from "@/lib/roadmaps/remove";
import { displayTitle } from "@/lib/roadmaps/title";
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

  /** 削除の確認を出している対象 */
  const [confirming, setConfirming] = useState<RoadmapSummary | null>(null);

  /**
   * 削除を取り消せるようにするための控え（CLAUDE.md 13章）。
   *
   * 手元からはすぐ消すが、**サーバーへの削除だけを数秒遅らせる**。
   * 取り消されたら手元に書き戻すだけで済み、サーバー側には何も起きていないので
   * 復元処理が要らない。消えたものを作り直す経路を増やさないための作りにしている。
   */
  const [undoable, setUndoable] = useState<{
    summary: RoadmapSummary;
    /** 手元にも持っていた場合の控え。サーバーにしか無いものは null */
    snapshot: LocalSnapshot | null;
  } | null>(null);
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  /** 猶予のあいだに画面を離れたら、その場でサーバーからも消す */
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        void deleteRoadmapOnServer(pending.current.id);
        pending.current = null;
      }
    },
    [],
  );

  const remove = useCallback(async (summary: RoadmapSummary) => {
    setConfirming(null);

    // 手元に無いこともある（別端末で作ったもの、IndexedDB を消した後のもの）。
    // その場合も一覧からは外し、取り消せるようにする
    const snapshot = await loadLocalRoadmap(summary.id);
    await deleteLocalRoadmap(summary.id);
    setSummaries((prev) => prev.filter((s) => s.id !== summary.id));
    setUndoable({ summary, snapshot });

    const timer = setTimeout(() => {
      pending.current = null;
      setUndoable(null);
      void deleteRoadmapOnServer(summary.id);
    }, 6000);
    pending.current = { id: summary.id, timer };
  }, []);

  const undo = useCallback(async () => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
    if (undoable) {
      // サーバーへの削除はまだ走っていないので、手元に書き戻すだけでよい
      if (undoable.snapshot) await saveLocal(undoable.snapshot);
      const restored = undoable.summary;
      setSummaries((prev) =>
        [...prev, restored].sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        ),
      );
    }
    setUndoable(null);
  }, [undoable]);

  useEffect(() => {
    let alive = true;

    (async () => {
      /**
       * 別アカウントへ切り替えた直後なら、手元のぶんを新しい所有者のもとに
       * 作り直してから一覧を出す（lib/roadmaps/carry.ts）。
       * 先に一覧を出すと、持っていく前の状態が一瞬見えてしまう
       */
      if (sessionStorage.getItem(CARRY_FLAG)) {
        sessionStorage.removeItem(CARRY_FLAG);
        const carried = await carryLocalRoadmapsToCurrentUser();
        if (carried > 0) {
          // サーバー側にも増えたので、サーバーのぶんを取り直す
          router.refresh();
        }
      }

      const local = await listLocal();
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
    })();

    return () => {
      alive = false;
    };
  }, [serverSummaries, router]);

  const create = async () => {
    const roadmap = newRoadmap();
    await saveLocal({ roadmap, books: [] });
    router.push(`/roadmaps/${roadmap.id}`);
  };

  return (
    <div data-touch-surface className="flex min-h-dvh flex-col px-4 pb-10 pt-6">
      <div className="mb-1 flex items-start gap-2">
        <h1 className="flex-1 font-serif text-[1.36rem] font-semibold leading-[1.42]">
          自分のルート
        </h1>
        <LoginButton next="/" />
      </div>
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
            <li key={s.id} className="relative">
              {/* 破壊的操作はカードの上に置かない。シート越しにする（CLAUDE.md 8章） */}
              <button
                type="button"
                aria-label={`${displayTitle(s.title)} の設定`}
                onClick={() => setConfirming(s)}
                className="absolute right-2 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-deep hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span aria-hidden="true" className="text-[1.05rem] leading-none">
                  ⋯
                </span>
              </button>

              <Link
                href={`/roadmaps/${s.id}`}
                className="block rounded-[12px] border border-rule bg-sunk py-3.5 pl-4 pr-12 transition-colors hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`min-w-0 flex-1 font-serif text-[1.02rem] font-semibold leading-snug ${
                      s.title.trim() ? "" : "text-ink-faint"
                    }`}
                  >
                    {displayTitle(s.title)}
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

      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="このルートを削除する"
      >
        {confirming && (
          <div className="flex flex-col gap-4 px-4 pb-5 pt-1">
            <div className="rounded-[10px] bg-sunk px-3.5 py-3">
              <div className="font-serif text-[1rem] font-semibold leading-snug">
                {displayTitle(confirming.title)}
              </div>
              <div className="mt-0.5 font-mono text-[0.7rem] text-ink-faint">
                参考書 {confirming.totalCount} 冊
              </div>
            </div>

            <p className="text-[0.82rem] leading-[1.75] text-ink-faint">
              {confirming.isPublic
                ? "公開中です。共有したリンクは開けなくなります。"
                : "並べた順番とメモも一緒に消えます。"}
            </p>

            <button
              type="button"
              onClick={() => remove(confirming)}
              className="w-full rounded-[10px] border border-thread px-4 py-3 text-[0.9rem] font-medium text-thread hover:bg-thread-soft"
            >
              削除する
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="w-full py-1 text-[0.82rem] text-ink-soft underline underline-offset-[3px] hover:text-ink"
            >
              やめる
            </button>
          </div>
        )}
      </Sheet>

      <Toast
        message={undoable ? `「${displayTitle(undoable.summary.title)}」を削除した` : null}
        onDismiss={() => setUndoable(null)}
        durationMs={6000}
        action={{ label: "取り消す", onClick: undo }}
      />
    </div>
  );
}
