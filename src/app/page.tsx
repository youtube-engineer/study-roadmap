import { RoadmapList } from "@/components/roadmap/RoadmapList";
import { loadOwnSummaries } from "@/lib/roadmaps/store";

/**
 * 再訪問者が最初に見る画面（CLAUDE.md 10章）。
 * サーバーにあるぶんを渡し、手元にしか無いものは画面側で足す。
 */
export default async function HomePage() {
  const serverSummaries = await loadOwnSummaries();

  return <RoadmapList serverSummaries={serverSummaries} />;
}
