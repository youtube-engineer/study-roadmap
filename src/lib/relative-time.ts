/**
 * 「3日前」のような表示。
 *
 * 一覧で見たいのは正確な日時ではなく「最近触ったかどうか」なので、粗くてよい。
 */
export function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}
