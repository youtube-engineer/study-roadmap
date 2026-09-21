/**
 * 表示用のルート名。
 *
 * 名前は空のままでも構わない（作った直後は空で、見出しに「無題のルート」が
 * 薄く出る）。ただし一覧・共有ページ・OGPで名無しになると困るので、
 * **表示する側で補う**。保存されている値は空のまま触らない。
 */
export const UNTITLED = "無題のロードマップ";

export function displayTitle(title: string): string {
  return title.trim() || UNTITLED;
}
