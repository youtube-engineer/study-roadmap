"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  CARRY_FLAG,
  CARRY_RETURN_ID,
  SWITCH_ATTEMPTED,
} from "@/components/auth/LoginButton";
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
import { newRoadmap } from "@/lib/roadmaps/create";
import { deleteRoadmapOnServer } from "@/lib/roadmaps/remove";
import { displayTitle } from "@/lib/roadmaps/title";
import { relativeTime } from "@/lib/relative-time";
import type { RoadmapSummary } from "@/types/roadmap";

/** 最後に触った順。触った時刻が無いもの（他端末で作られたもの）は作成日で代用する */
function touchedAt(s: RoadmapSummary): string {
  return s.updatedAt ?? s.createdAt ?? "";
}

function byRecency(a: RoadmapSummary, b: RoadmapSummary): number {
  return touchedAt(b).localeCompare(touchedAt(a));
}

/** 「5冊 · 2冊終了 · 3日前」。数えるのではなく、状態が一目で読めればいい */
function metaLine(s: RoadmapSummary): string {
  const parts: string[] = [];
  if (s.totalCount === 0) {
    parts.push("まだ空");
  } else {
    parts.push(`${s.totalCount}冊`);
    parts.push(
      s.doneCount === 0
        ? "まだ始めていない"
        : s.doneCount === s.totalCount
          ? "ぜんぶ終了"
          : `${s.doneCount}冊終了`,
    );
  }
  const when = relativeTime(touchedAt(s));
  if (when) parts.push(when);
  return parts.join(" · ");
}

type Props = {
  /** サーバー（Supabase）にあるぶん。ログイン前や未接続なら空 */
  serverSummaries: RoadmapSummary[];
  /** いま開いているルート。一覧で現在地を示す */
  currentId?: string;
};

/**
 * ルートの一覧。左から出るドロワー。
 *
 * **編集画面から直接開けること**が要点で、一覧ページへ戻ってから開き直す形にしない。
 * ルートを行き来しながら組むので、切り替えに画面遷移を挟ませたくない。
 *
 * 中身はサーバーとローカルを突き合わせて出す。同じ id があればローカルを採る
 * （操作のたびに書いているのでローカルの方が新しい）。ローカルにしか無いもの
 * ——ログインする前に作ったもの——も並ぶ。
 */
export function RoadmapDrawer({ serverSummaries, currentId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summaries, setSummaries] = useState<RoadmapSummary[]>(serverSummaries);

  const [confirming, setConfirming] = useState<RoadmapSummary | null>(null);
  /** 削除の最終確認。ロードマップは中の参考書ごと消えるので一段挟む */
  const [confirmedOnce, setConfirmedOnce] = useState(false);
  const [undoable, setUndoable] = useState<{
    summary: RoadmapSummary;
    /** 手元にも持っていた場合の控え。サーバーにしか無いものは null */
    snapshot: LocalSnapshot | null;
  } | null>(null);
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

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
        sessionStorage.removeItem(SWITCH_ATTEMPTED);

        const { carried, moved } = await carryLocalRoadmapsToCurrentUser();
        if (carried > 0) router.refresh();

        // 切り替える前に開いていたルートの移動先へ送る。
        // 何も言わずに別のルートが表示されるのを避ける
        const returnId = sessionStorage.getItem(CARRY_RETURN_ID);
        sessionStorage.removeItem(CARRY_RETURN_ID);
        const destination = returnId ? moved.get(returnId) : undefined;
        if (destination) {
          router.replace(`/roadmaps/${destination}`);
          return;
        }
      }

      const local = await listLocal();
      if (!alive) return;

      const byId = new Map(serverSummaries.map((s) => [s.id, s]));
      for (const s of local) byId.set(s.id, s);
      setSummaries([...byId.values()].sort(byRecency));
    })();

    return () => {
      alive = false;
    };
  }, [serverSummaries, router]);

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

  const create = useCallback(async () => {
    const roadmap = newRoadmap();
    await saveLocal({ roadmap, books: [] });
    setOpen(false);
    router.push(`/roadmaps/${roadmap.id}`);
  }, [router]);

  const remove = useCallback(
    async (summary: RoadmapSummary) => {
      setConfirming(null);

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

      // 開いているものを消したら、残っているどれかへ移す
      if (summary.id === currentId) {
        const next = summaries.find((s) => s.id !== summary.id);
        router.push(next ? `/roadmaps/${next.id}` : "/");
      }
    },
    [currentId, router, summaries],
  );

  const undo = useCallback(async () => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
    if (undoable) {
      // サーバーへの削除はまだ走っていないので、手元に書き戻すだけでよい
      if (undoable.snapshot) await saveLocal(undoable.snapshot);
      const restored = undoable.summary;
      setSummaries((prev) => [...prev, restored].sort(byRecency));
    }
    setUndoable(null);
  }, [undoable]);

  return (
    <>
      <button
        type="button"
        aria-label="ロードマップの一覧"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-ml-1 grid h-8 w-8 flex-none place-items-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-[90] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-[rgba(12,14,18,0.42)] transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          role="dialog"
          aria-label="ロードマップの一覧"
          aria-modal={open}
          className={`absolute inset-y-0 left-0 flex w-[min(300px,82%)] flex-col border-r border-rule bg-raised shadow-lift transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/*
            サービス名は出さない。**中にいる人には要らない。**
            名乗る必要があるのは共有ページ（外から来た人が見る画面）だけ。
            ここに置くと、切り替える道具として使う画面の一等地を説明語が占める。
          */}
          <ul className="flex-1 overflow-y-auto px-2 py-3">
            {summaries.length === 0 && (
              <li className="px-2 py-6 text-[0.8rem] leading-relaxed text-ink-faint">
                まだ1本もありません。
              </li>
            )}

            {summaries.map((s) => (
              <li key={s.id} className="relative">
                {/* 破壊的操作はここには置かず、シート越しにする（CLAUDE.md 8章） */}
                <button
                  type="button"
                  aria-label={`${displayTitle(s.title)} の設定`}
                  onClick={() => setConfirming(s)}
                  className="absolute right-0.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-deep hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span aria-hidden="true" className="text-[1rem] leading-none">
                    ⋯
                  </span>
                </button>

                <Link
                  href={`/roadmaps/${s.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={s.id === currentId ? "page" : undefined}
                  className={`block rounded-[8px] py-2 pl-2.5 pr-8 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    s.id === currentId ? "bg-sunk" : "hover:bg-sunk"
                  }`}
                >
                  <span className="block min-w-0">
                    <span
                      className={`block text-[0.9rem] font-bold leading-[1.4] ${
                        s.title.trim() ? "text-ink-title" : "text-ink-faint"
                      }`}
                    >
                      {displayTitle(s.title)}
                      {s.isCopy && (
                        <span className="font-sans text-[0.72rem] font-normal text-ink-faint">
                          {s.copiedFromName
                            ? `（${s.copiedFromName}さんのコピー）`
                            : "（コピー）"}
                        </span>
                      )}
                    </span>
                    <span className="mt-[0.1rem] block text-[0.7rem] tabular-nums text-ink-faint">
                      {metaLine(s)}
                      {s.isPublic ? " · 公開中" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-rule px-3 py-3">
            <button
              type="button"
              onClick={create}
              className="w-full rounded-[9px] border border-rule-strong px-3 py-2.5 text-[0.84rem] text-ink-soft hover:border-accent hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              ＋ 新しいロードマップを作る
            </button>
          </div>
        </div>
      </div>

      <Sheet
        open={confirming !== null}
        onClose={() => {
          setConfirming(null);
          setConfirmedOnce(false);
        }}
        title="このロードマップを削除する"
      >
        {confirming && (
          <div className="flex flex-col gap-4 px-4 pb-5 pt-1">
            <div className="rounded-[10px] bg-sunk px-3.5 py-3">
              <div className="text-[1rem] font-bold leading-snug text-ink-title">
                {displayTitle(confirming.title)}
              </div>
              <div className="mt-0.5 text-[0.75rem] tabular-nums text-ink-faint">
                参考書 {confirming.totalCount} 冊
              </div>
            </div>

            <p className="text-[0.82rem] leading-[1.75] text-ink-faint">
              {confirming.isPublic
                ? "公開中です。共有したリンクは開けなくなります。消したあと数秒は取り消せます。"
                : "並べた順番とメモも一緒に消えます。消したあと数秒は取り消せます。"}
            </p>

            {confirmedOnce ? (
              <div className="flex flex-col gap-2 rounded-[10px] border border-thread bg-thread-soft px-3.5 py-3">
                <p className="text-[0.88rem] font-bold text-thread">本当に消しますか？</p>
                <button
                  type="button"
                  onClick={() => remove(confirming)}
                  className="w-full rounded-[9px] bg-thread px-4 py-2.5 text-[0.88rem] font-bold text-white"
                >
                  消す
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmedOnce(false)}
                  className="w-full py-1 text-[0.8rem] text-ink-soft underline underline-offset-[3px]"
                >
                  やめる
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmedOnce(true)}
                  className="w-full rounded-[10px] border border-thread px-4 py-3 text-[0.9rem] font-bold text-thread hover:bg-thread-soft"
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
              </>
            )}
          </div>
        )}
      </Sheet>

      <Toast
        message={undoable ? `「${displayTitle(undoable.summary.title)}」を削除した` : null}
        onDismiss={() => setUndoable(null)}
        durationMs={6000}
        action={{ label: "取り消す", onClick: undo }}
      />
    </>
  );
}
