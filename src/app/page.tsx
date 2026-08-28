import { RoadmapEditor } from "@/components/roadmap/RoadmapEditor";
import { loadOwnRoadmap } from "@/lib/roadmaps/store";

export default async function EditorPage() {
  const { roadmap, books } = await loadOwnRoadmap();

  return <RoadmapEditor roadmap={roadmap} books={books} />;
}
