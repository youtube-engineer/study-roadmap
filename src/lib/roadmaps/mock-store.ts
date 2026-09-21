import type { Roadmap } from "@/types/roadmap";

/**
 * 仮のロードマップ。Supabase + IndexedDB に差し替わるまでの繋ぎ。
 * ここが本当に価値のあるデータ（どの参考書がどの順番でどんなメモと一緒に
 * 並べられたか）で、書誌データと違って100%自前のもの（CLAUDE.md 6章）。
 */

const OWN_ROADMAP: Roadmap = {
  id: "r-own",
  title: "英検2級までのルート",
  isPublic: true,
  shareSlug: "8k2m4p",
  tags: ["英検", "英検2級"],
  authorName: null,
  copiedFrom: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  stages: [
    {
      id: "st-own",
      name: "単語・文法",
      items: [
    {
      id: "i1",
      bookId: "b8",
      isDone: true,
      roundsTarget: 3,
      note: "知らない単語だけ付箋。2周目からは付箋の分だけ。",
    },
    { id: "i2", bookId: "b2", isDone: true, roundsTarget: 3, note: "" },
    {
      id: "i3",
      bookId: "b4",
      isDone: false,
      roundsTarget: 2,
      note: "ライティングの型はここで覚える。英作文の章は最優先。",
    },
    { id: "i4", bookId: "b1", isDone: false, roundsTarget: 1, note: "" },
    {
      id: "i5",
      bookId: "b6",
      isDone: false,
      roundsTarget: null,
        note: "一次に受かってから着手でいい。",
      },
      ],
    },
  ],
};

const SHARED_ROADMAP: Roadmap = {
  id: "r-shared",
  title: "独学で英検準1級に受かるまで",
  isPublic: true,
  shareSlug: "hinata-eiken1",
  tags: ["英検", "英検準1級", "独学"],
  authorName: "ひなた",
  copiedFrom: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  stages: [
    {
      id: "st-shared",
      name: "単語",
      items: [
    {
      id: "s1",
      bookId: "b9",
      isDone: true,
      roundsTarget: 4,
      note: "準1級はここが山場。1日100語を高速で回して、4周する前提で組んだ方がいい。",
    },
    {
      id: "s2",
      bookId: "b16",
      isDone: true,
      roundsTarget: 2,
      note: "単語が頭に入ってから。文章で覚え直すと定着が全然違う。",
    },
    {
      id: "s3",
      bookId: "b15",
      isDone: true,
      roundsTarget: 2,
      note: "1周目は時間を計らずに解いて、2周目から本番の時間で。",
    },
    {
      id: "s4",
      bookId: "b7",
      isDone: false,
      roundsTarget: 1,
      note: "リスニングが足を引っ張るなら早めに挟む。2級用だが準1級対策としても効く。",
    },
    {
      id: "s5",
      bookId: "b17",
      isDone: false,
      roundsTarget: 1,
        note: "一次に受かってからで間に合う。音読は毎日やる。",
      },
      ],
    },
  ],
};

const ALL = [OWN_ROADMAP, SHARED_ROADMAP];

/** TODO(Supabase): 差し替えるまでのあいだ、コピー結果をプロセス内に置いておくだけ */
let own: Roadmap = OWN_ROADMAP;

export async function getOwnRoadmap(): Promise<Roadmap> {
  // TODO(Supabase): 匿名認証の owner_id で引く。実際は IndexedDB から先に読む
  return own;
}

/**
 * 共有されたルートを自分のものとして複製する。
 *
 * **参照ではなく実体の複製**（CLAUDE.md 6章）。元が書き換えられてもコピー側は
 * 影響を受けず、逆も同じ。
 *   - 引き継ぐ: 並び順 / bookId / roundsTarget / note / タイトル / タグ
 *   - 引き継がない: isDone（元の作成者の進捗であって自分のものではない）
 *   - copiedFrom にコピー時点のスナップショットを残す。元が削除されたり非公開に
 *     戻されるのは正当な行為なのでリンクは必ず切れる。表示だけは残す
 */
export async function copyRoadmap(slug: string): Promise<Roadmap | null> {
  const source = await getRoadmapBySlug(slug);
  if (!source) return null;

  own = {
    id: crypto.randomUUID(),
    title: source.title,
    isPublic: false,
    shareSlug: crypto.randomUUID().slice(0, 6),
    tags: [...source.tags],
    authorName: null,
    createdAt: new Date().toISOString(),
    copiedFrom: {
      roadmapId: source.shareSlug,
      title: source.title,
      authorName: source.authorName,
    },
    stages: source.stages.map((stage) => ({
      ...stage,
      id: crypto.randomUUID(),
      items: stage.items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        isDone: false,
      })),
    })),
  };
  return own;
}

/**
 * 共有ページ用。share_slug で引く。
 *
 * TODO(Supabase): 「is_public=true かつ share_slug 一致なら誰でも読める」を
 * RLSの独立したポリシーとして持たせる。アプリ側に判定を散らさない（CLAUDE.md 6章）。
 */
export async function getRoadmapBySlug(slug: string): Promise<Roadmap | null> {
  return ALL.find((r) => r.shareSlug === slug && r.isPublic) ?? null;
}

export async function listPublicSlugs(): Promise<string[]> {
  return ALL.filter((r) => r.isPublic).map((r) => r.shareSlug);
}
