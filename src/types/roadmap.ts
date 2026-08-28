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
  items: RoadmapItem[];
  /** 匿名のままでも共有はできる。名前を出すにはログインが必要（CLAUDE.md 13章） */
  authorName: string | null;
  copiedFrom: CopiedFrom | null;
};

export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 20;
