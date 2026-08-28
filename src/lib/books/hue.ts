/**
 * 書名から色相を作る。表紙が無い / 読めないときの代替表示に使う。
 * 同じ本なら必ず同じ色になる必要があるので、乱数ではなく書名から決める。
 */
export function hueFromTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i += 1) {
    h = (h * 31 + title.charCodeAt(i)) % 360;
  }
  return h;
}
