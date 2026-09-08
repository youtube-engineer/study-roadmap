import { RoadmapEditor } from "@/components/roadmap/RoadmapEditor";
import { loadRoadmap } from "@/lib/roadmaps/store";

type Props = { params: Promise<{ id: string }> };

/**
 * 編集画面。
 *
 * サーバーに無くても 404 にしない。ログイン前に作ったものは IndexedDB に
 * しか無く、それが正常な状態だから（CLAUDE.md 5章）。
 */
export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const { roadmap, books } = await loadRoadmap(id);

  return <RoadmapEditor roadmap={roadmap} books={books} />;
}
