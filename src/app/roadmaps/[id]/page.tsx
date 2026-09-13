import { RoadmapEditor } from "@/components/roadmap/RoadmapEditor";
import { loadOwnSummaries, loadRoadmap } from "@/lib/roadmaps/store";

type Props = { params: Promise<{ id: string }> };

/**
 * 編集画面。
 *
 * サーバーに無くても 404 にしない。ログイン前に作ったものは IndexedDB に
 * しか無く、それが正常な状態だから（CLAUDE.md 5章）。
 */
export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const [{ roadmap, books }, summaries] = await Promise.all([
    loadRoadmap(id),
    loadOwnSummaries(),
  ]);

  /*
    key を付けて、別のルートへ移ったら作り直させる。
    同じ経路のまま id だけ変わると React はコンポーネントを使い回すので、
    useState の初期値が更新されず**前のルートの内容が残る**。
    「新しく作ったのに他人のルートの表示が出る」のはこれだった。
  */
  return <RoadmapEditor key={id} roadmap={roadmap} books={books} summaries={summaries} />;
}
