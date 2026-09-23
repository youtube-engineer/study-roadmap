import { redirect } from "next/navigation";

import { HomeEntry } from "@/components/roadmap/HomeEntry";
import { loadOwnSummaries } from "@/lib/roadmaps/store";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : null;

  /**
   * ★ **認可コードが入口に落ちてきたら、交換する画面へ渡す。**
   *
   * Supabase は `redirectTo` が**許可リスト（Redirect URLs）に無いと、
   * 黙って Site URL に差し替える。** そうなるとコードは `/auth/callback`
   * ではなく `/` に届き、誰も交換しないまま捨てられる——
   * 「ログインしたのにログインのままだ」という形で現れる。
   *
   * 本来の直し方は許可リストに入れること（localhost を入れ忘れると、
   * 手元でログインしたのに本番へ飛ばされる）。ここはその取りこぼしを
   * 拾うための受け皿で、**設定の代わりにはならない。**
   */
  if (code) {
    const query = new URLSearchParams({ code, next: "/" });
    redirect(`/auth/callback?${query.toString()}`);
  }

  const serverSummaries = await loadOwnSummaries();

  return <HomeEntry serverSummaries={serverSummaries} />;
}
