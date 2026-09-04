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

/**
 * まっさらなロードマップを実体として作る。
 *
 * 作らずに済ませると、共有ページで「まっさらから作る」を押しても
 * ローカルに残っている前のロードマップが表示されたままになる。
 */
export async function startBlankForCurrentUser(): Promise<string | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;

  const user = await requireUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("roadmaps")
    .insert({
      owner_id: user.id,
      title: "新しいルート",
      share_slug: newShareSlug(),
      is_public: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[roadmaps] まっさらの作成に失敗", error);
    return null;
  }
  return data.id;
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

  const { data: sourceItems } = await supabase
    .from("roadmap_items")
    .select("*")
    .eq("roadmap_id", source.id)
    .order("fractional_index", { ascending: true });

  const user = await requireUser(supabase);
  if (!user) return null;

  const { data: created, error } = await supabase
    .from("roadmaps")
    .insert({
      owner_id: user.id,
      title: source.title,
      share_slug: newShareSlug(),
      is_public: false,
      copied_from_id: source.id,
      copied_from_title: source.title,
      copied_from_name: source.copied_from_name,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[copy] roadmaps", error);
    return null;
  }

  if (sourceItems && sourceItems.length > 0) {
    const { error: itemsError } = await supabase.from("roadmap_items").insert(
      sourceItems.map((item) => ({
        roadmap_id: created.id,
        book_id: item.book_id,
        fractional_index: item.fractional_index,
        // 進捗は引き継がない
        is_done: false,
        rounds_target: item.rounds_target,
        note: item.note,
      })),
    );
    if (itemsError) console.error("[copy] roadmap_items", itemsError);
  }

  return created.id;
}
