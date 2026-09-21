import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SharedStage } from "@/components/roadmap/SharedStage";
import { RakutenCredit } from "@/components/sheets/RakutenCredit";
import { StartBlankButton } from "@/components/roadmap/StartBlankButton";
import { FlagIcon } from "@/components/ui/icons";
import { copyRoadmapAction } from "@/lib/roadmaps/actions";
import { loadSharedRoadmap } from "@/lib/roadmaps/store";
import { allItems } from "@/types/roadmap";
import { displayTitle } from "@/lib/roadmaps/title";

type Props = { params: Promise<{ slug: string }> };

/**
 * 共有ページ。読み取り専用で、SSRで配信して検索エンジン経由の流入も狙う。
 *
 * 公開URL1つ1つが「特定の参考書ルートについてのページ」になる。これが本命の
 * 検索対策なので、クライアント側の描画に依存させない（CLAUDE.md 12章）。
 * dnd-kit もシートもこのページには載らない。
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadSharedRoadmap(slug);
  if (!loaded) return { title: "見つかりませんでした" };
  const { roadmap } = loaded;

  const by = roadmap.authorName ? `${roadmap.authorName}さんの` : "";
  const description = `${by}参考書${allItems(roadmap).length}冊のルート。`;
  const title = displayTitle(roadmap.title);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/r/${roadmap.shareSlug}`,
    },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `/r/${roadmap.shareSlug}` },
  };
}

export default async function SharedRoadmapPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await loadSharedRoadmap(slug);
  if (!loaded) notFound();

  const { roadmap, books } = loaded;
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));
  const count = allItems(roadmap).length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-1.5 border-b border-rule px-4 pb-2.5 pt-3">
        {/* 他人のページなので、どこのサービスかが分かるようにする */}
        <span className="font-serif text-[0.92rem] font-semibold tracking-[0.1em] text-ink-soft">
          参考書ロードマップ
        </span>
        <span className="flex-1" />
        <span className="rounded-full border border-rule px-2.5 py-[0.14em] text-[0.7rem] text-ink-faint">
          閲覧のみ
        </span>
      </header>

      <div className="px-4 pb-1 pt-4">
        <h1 className="mb-2.5 font-serif text-[1.36rem] font-semibold leading-[1.42] text-balance">
          {displayTitle(roadmap.title)}
        </h1>

        {/* 匿名でも共有はできる。名前が出るのはログインしている場合だけ（CLAUDE.md 13章） */}
        {roadmap.authorName && (
          <div className="-mt-0.5 mb-2.5 flex items-center gap-2 text-[0.78rem] text-ink-soft">
            <span
              aria-hidden="true"
              className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-accent-soft text-[0.72rem] font-bold text-accent-strong"
            >
              {roadmap.authorName.slice(0, 1)}
            </span>
            <span>{roadmap.authorName} さんのルート</span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          {/* タグは今は出さない。テーブルと型は残してあるので、使うときに戻す */}
          <span className="flex-1" />
          <span className="flex-none font-mono text-[0.66rem] text-ink-faint">
            参考書 {count} 冊
          </span>
        </div>
      </div>

      <div className="pb-6 pt-4">
        {roadmap.stages.map((stage, index) => (
          <div key={stage.id}>
            <SharedStage stage={stage} index={index} books={bookMap} />
            <div className="h-4" />
          </div>
        ))}

        {/* GOAL */}
        <section className="relative pl-[46px]">
          <span className="absolute left-[15px] top-0 flex h-8 w-[22px] justify-center">
            <span
              aria-hidden="true"
              className="absolute top-0 h-2.5 w-[3px] rounded-sm bg-thread opacity-70"
            />
            <span className="relative z-[2] mt-0.5 grid h-6 w-6 place-items-center self-start rounded-full bg-thread text-white shadow-[0_0_0_4px_var(--raised)]">
              <FlagIcon size={12} />
            </span>
          </span>
          <span className="inline-block pt-1 font-mono text-[0.68rem] tracking-[0.16em] text-ink-faint">
            GOAL
          </span>
        </section>
      </div>

      <div className="mx-4 mb-6 rounded-[14px] bg-deep px-4 py-5 text-center">
        <p className="mb-3.5 text-[0.87rem] leading-[1.75] text-ink-soft">
          このルートをコピーすると、自分用に並び替えたり本を足したりできる。
          <br />
          <span className="text-[0.79rem] text-ink-faint">元のルートは書き換わらない。</span>
        </p>

        <form action={copyRoadmapAction}>
          <input type="hidden" name="slug" value={roadmap.shareSlug} />
          <button
            type="submit"
            className="w-full rounded-[10px] bg-accent px-4 py-3 text-[0.95rem] font-medium text-white hover:bg-accent-strong"
          >
            このルートをコピーして使う
          </button>
        </form>

        <StartBlankButton className="mt-2 w-full py-2 text-[0.82rem] text-ink-soft underline underline-offset-[3px] hover:text-ink" />

        <p className="mt-2 text-[0.73rem] text-ink-faint">ログインなしで、すぐに始められる</p>
      </div>

      <footer className="mt-auto flex justify-center border-t border-rule px-4 py-3">
        <RakutenCredit />
      </footer>
    </div>
  );
}
