import { HomeEntry } from "@/components/roadmap/HomeEntry";
import { loadOwnSummaries } from "@/lib/roadmaps/store";

export default async function HomePage() {
  const serverSummaries = await loadOwnSummaries();

  return <HomeEntry serverSummaries={serverSummaries} />;
}
