import "server-only";

import { getServerClient } from "@/lib/supabase/server";

import { newShareSlug } from "./slug";

/**
 * 共有されたルートを、今このページを見ている人のものとして複製する。
 *
 * **参照ではなく実体の複製**（CLAUDE.md 6章）。
 *   - 引き継ぐ: 並び順 / book_id / rounds_target / note / タイトル
 *   - 引き継がない: is_done（元の作成者の進捗であって自分のものではない）
 *   - copied_from_id は辿るため、copied_from_title / _name は記録として残すため
 *
 * コピーは書き込みなので、ここで初めて匿名サインインが走る。
 */
/**
 * 匿名サインイン済みのユーザーを返す。まだなら**ここで発行する**。
 *
 * 訪問しただけでは呼ばれない。コピーや「まっさらから作る」は明確な意思表示なので、
 * この時点で作るのは 5章の「摩擦をゼロにする」と矛盾しない。
 */
async function requireUser(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("[roadmaps] 匿名サインインに失敗", error);
    return null;
  }
  return data.user;
}

export async function copyRoadmapForCurrentUser(slug: string): Promise<string | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;

  const { data: source } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle();

  if (!source) return null;

  const [{ data: sourceStages }, { data: sourceItems }] = await Promise.all([
    supabase
      .from("roadmap_stages")
      .select("*")
      .eq("roadmap_id", source.id)
      .order("fractional_index", { ascending: true }),
    supabase
      .from("roadmap_items")
      .select("*")
      .eq("roadmap_id", source.id)
      .order("fractional_index", { ascending: true }),
  ]);

  const user = await requireUser(supabase);
  if (!user) return null;

  const { data: created, error } = await supabase
    .from("roadmaps")
    .insert({
      owner_id: user.id,
      title: source.title,
      // ゴールは引き継ぐ。何を目指すルートなのかはコピーする側が見ていたもの
      goal: source.goal,
      share_slug: newShareSlug(),
      is_public: false,
      copied_from_id: source.id,
      copied_from_title: source.title,
      // TODO(13章): コピー元の「作成者名」を入れる場所。まだ名前を持っていないので null。
      // source.copied_from_name を入れると、コピー元のさらに元の人の名前が
      // 引き継がれてしまう（別人の名前が出る）
      copied_from_name: null,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[copy] roadmaps", error);
    return null;
  }

  /**
   * 段ごと作り直す。段のidは新しくするので、元id → 新id の対応を持っておかないと
   * 参考書をどの段に入れればいいか分からなくなる。
   */
  const stageIds = new Map<string, string>();
  if (sourceStages && sourceStages.length > 0) {
    const rows = sourceStages.map((stage) => {
      const newStageId = crypto.randomUUID();
      stageIds.set(stage.id, newStageId);
      return {
        id: newStageId,
        roadmap_id: created.id,
        name: stage.name,
        fractional_index: stage.fractional_index,
      };
    });
    const { error: stagesError } = await supabase.from("roadmap_stages").insert(rows);
    if (stagesError) console.error("[copy] roadmap_stages", stagesError);
  }

  if (sourceItems && sourceItems.length > 0) {
    const rows = sourceItems
      .map((item) => {
        const stageId = stageIds.get(item.stage_id);
        if (!stageId) return null;
        return {
          roadmap_id: created.id,
          stage_id: stageId,
          book_id: item.book_id,
          fractional_index: item.fractional_index,
          // 進捗は引き継がない
          is_done: false,
          rounds_target: item.rounds_target,
          note: item.note,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from("roadmap_items").insert(rows);
      if (itemsError) console.error("[copy] roadmap_items", itemsError);
    }
  }

  return created.id;
}
