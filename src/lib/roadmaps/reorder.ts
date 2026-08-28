/**
 * 並び替え。
 *
 * TODO(Supabase): 永続化するときは fractional indexing にして、動かした行だけ
 * fractional_index を更新する。1冊動かすたびに全行を書き換えない（CLAUDE.md 4章）。
 * 配列の順番はあくまで画面上の表現。
 */
export function moveItem<T extends { id: string }>(
  items: readonly T[],
  activeId: string,
  overId: string,
): T[] {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from < 0 || to < 0 || from === to) return [...items];

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
