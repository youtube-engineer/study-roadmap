import type { Book } from "@/types/roadmap";

/**
 * 仮の書誌データ。楽天ブックス書籍検索API に差し替わるまでの繋ぎ。
 * 差し替えるのは source.ts の1箇所だけで済むようにしてある。
 */
const CATALOG: Book[] = [
  ["b1", "英検2級 過去6回全問題集", "旺文社", "2025", 210],
  ["b2", "英検2級 でる順パス単", "旺文社", "2024", 18],
  ["b3", "英検2級 文で覚える単熟語", "旺文社", "2024", 160],
  ["b4", "英検2級 総合対策教本", "旺文社", "2024", 268],
  ["b5", "DAILY20日間 英検2級 集中ゼミ", "旺文社", "2024", 42],
  ["b6", "英検2級 二次試験・面接完全予想問題", "旺文社", "2024", 340],
  ["b7", "英検2級 リスニング問題完全制覇", "ジャパンタイムズ出版", "2023", 190],
  ["b8", "英検準2級 でる順パス単", "旺文社", "2024", 96],
  ["b9", "英検準1級 でる順パス単", "旺文社", "2024", 4],
  ["b10", "英文法ポラリス1", "KADOKAWA", "2019", 232],
  ["b11", "英単語ターゲット1900", "旺文社", "2023", 30],
  ["b12", "システム英単語", "駿台文庫", "2019", 140],
  ["b13", "英検2級 頻出度別問題集", "高橋書店", "2023", 300],
  ["b14", "関正生の英文法ポラリス2", "KADOKAWA", "2020", 250],
  ["b15", "英検準1級 過去6回全問題集", "旺文社", "2025", 224],
  ["b16", "英検準1級 文で覚える単熟語", "旺文社", "2024", 172],
  ["b17", "英検準1級 二次試験・面接完全予想問題", "旺文社", "2024", 320],
].map(([id, title, author, publishedYear, hue]) => ({
  id: id as string,
  isbn: null,
  source: "mock" as const,
  title: title as string,
  author: author as string,
  publishedYear: publishedYear as string,
  coverImageUrl: null,
  sourceUrl: null,
  hue: hue as number,
}));

export function mockSearch(query: string): Book[] {
  const q = query.trim();
  if (!q) return CATALOG.slice(0, 7);
  return CATALOG.filter((b) => b.title.includes(q) || b.author.includes(q));
}

export function mockFindMany(ids: readonly string[]): Book[] {
  return ids
    .map((id) => CATALOG.find((b) => b.id === id))
    .filter((b): b is Book => b !== undefined);
}
