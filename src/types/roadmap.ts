/**
 * ドメインの型。カラム名は CLAUDE.md 6章のデータモデルに合わせてある
 * （is_done / rounds_target / share_slug / copied_from_* ）。
 * 製品名は型にもテーブル名にも焼き込まない（CLAUDE.md 4章）。
 */

/**
 * 書誌データ。これは「自分たちの書籍DB」ではなく ISBN をキーにした表示用キャッシュ。
 * 本当に自分のデータなのは isbn だけで、title / author / coverImageUrl は
 * 提供元の規約が付いてくる借り物（CLAUDE.md 6章）。
 */
export type Book = {
  id: string;
  /** 国際標準の識別子。提供元を切り替えるときはここから引き直す */
  isbn: string | null;
  source: "rakuten" | "openbd" | "manual" | "mock";
  title: string;
  author: string;
  publishedYear: string | null;
  /** URLだけを持つ。画像ファイルは複製しない */
  coverImageUrl: string | null;
  /**
   * 出典ページ。楽天ウェブサービス規約 第8条4項で、ウェブサービスを使っている
   * 画面には楽天サイトへのリンクを置く義務があるため必須（CLAUDE.md 7章）。
   */
  sourceUrl: string | null;
  /**
   * 表紙が無い / 読めないときに使う色相。
   * 表紙は著作物で提供元ごとに条件が違うため、表紙に依存しない見た目を
   * 常に用意しておく（CLAUDE.md 7章）。
   */
  hue: number;
};

/**
 * 段。参考書をまとめる単位（「単語・文法」「長文」など）。
 *
 * 枝分かれ（8章で取り下げたもの）とは別物。あれは「本線か補助か」という
 * 性質の分岐だったが、これは順番に進む区切り。経路は1本のまま。
 */
export type RoadmapStage = {
  id: string;
  /** 自由入力。空でも構わない */
  name: string;
  items: RoadmapItem[];
  /** 並び順のキー（fractional indexing） */
  fractionalIndex?: string;
};

export type RoadmapItem = {
  id: string;
  bookId: string;
  /** 1タップで切り替わる最小限の進捗信号。何周目かは記録しない */
  isDone: boolean;
  /** 周回の「目標」（1〜20、未設定はnull）。進捗カウンターではない */
  roundsTarget: number | null;
  /** この本をどう使うかのメモ。共有時に相手が読む部分 */
  note: string;
  /**
   * 並び順のキー（fractional indexing）。
   * 1冊動かすたびに動かした行だけ更新するためのもの（CLAUDE.md 4章）。
   * 保存されていないロードマップではまだ持っていない。
   */
  fractionalIndex?: string;
};

/** コピー時点のスナップショット。元が消えても表示だけは残すために持つ（CLAUDE.md 6章） */
export type CopiedFrom = {
  roadmapId: string | null;
  title: string;
  authorName: string | null;
};

export type Roadmap = {
  id: string;
  title: string;
  isPublic: boolean;
  shareSlug: string;
  tags: string[];
  stages: RoadmapStage[];
  /** 匿名のままでも共有はできる。名前を出すにはログインが必要（CLAUDE.md 13章） */
  authorName: string | null;
  copiedFrom: CopiedFrom | null;
  /** 一覧の並び順に使う。ISO文字列 */
  createdAt: string;
  /**
   * 最後に触った時刻。IndexedDB へ書くたびに更新される。
   * サーバー側にはカラムを持たせていないので、他端末で作られたものには無い。
   * その場合は createdAt で代用する。
   */
  updatedAt?: string;
};

/** 一覧に出すぶんだけ。中身（items）は開くまで読まない */
export type RoadmapSummary = {
  id: string;
  title: string;
  tags: string[];
  isPublic: boolean;
  shareSlug: string;
  totalCount: number;
  doneCount: number;
  createdAt: string;
  updatedAt?: string;
  /** 他人のルートをコピーしたものか。一覧で名前の横に印を出す */
  copiedFromName: string | null;
  isCopy: boolean;
};

export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 20;

/** 段をまたいで全部の参考書を順に見る。冊数や進捗を数えるときに使う */
export function allItems(roadmap: Pick<Roadmap, "stages">): RoadmapItem[] {
  return roadmap.stages.flatMap((stage) => stage.items);
}

/** 段が終わったか。全部の本に印が付いていれば終わり。空の段は終わっていない */
export function isStageDone(stage: RoadmapStage): boolean {
  return stage.items.length > 0 && stage.items.every((i) => i.isDone);
}
