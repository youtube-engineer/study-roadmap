import { generateKeyBetween } from "fractional-indexing";

/**
 * 並び順のキーを作る。前後の行の間に挟むので、**動かした行だけ**更新すれば済む
 * （fractional indexing。CLAUDE.md 4章）。
 */
export function keyBetween(
  before: { fractionalIndex?: string } | undefined,
  after: { fractionalIndex?: string } | undefined,
): string {
  try {
    return generateKeyBetween(before?.fractionalIndex ?? null, after?.fractionalIndex ?? null);
  } catch {
    // 前後が壊れている（同じキーが並んでいる等）ときの逃げ道
    return generateKeyBetween(null, null);
  }
}
