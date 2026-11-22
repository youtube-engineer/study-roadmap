import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/** 並び順のキーを持つもの。段も参考書もこの形 */
type Ordered = { fractionalIndex?: string };

/** 「無い」は空文字で来ることがある（CLAUDE.md 14章）ので trim して落とす */
function key(row: Ordered | undefined): string | null {
  return row?.fractionalIndex?.trim() || null;
}

/**
 * 並び順のキーを作る。前後の行の間に挟むので、**動かした行だけ**更新すれば済む
 * （fractional indexing。CLAUDE.md 4章）。
 */
export function keyBetween(before: Ordered | undefined, after: Ordered | undefined): string {
  const b = key(before);
  const a = key(after);
  try {
    return generateKeyBetween(b, a);
  } catch {
    /**
     * ★ **逃げ道で `generateKeyBetween(null, null)` を返してはいけない。**
     *
     * 返るのは `a0` ——**取り得る中で最小のキー**なので、挟んだつもりの行が
     * 先頭へ飛ぶ。しかも落ちるたびに同じ値になるので、**`a0` が複数並ぶ。**
     * そうなると今度は `a0` と `a0` の間に挟む計算が必ず例外になり、
     * また `a0` が増える——**壊れ方が自分で広がる。**
     * 実際に1本のロードマップで9段のうち5段が `a0` になっていた。
     *
     * 前が読めるなら後ろへ、後ろが読めるなら前へ逃がす。どちらも駄目なときだけ
     * `a0` になるが、そのときは並べ直し（`orderByIndex`）が拾う。
     */
    if (b !== null) {
      try {
        return generateKeyBetween(b, null);
      } catch {
        /* 前も壊れている。下へ */
      }
    }
    if (a !== null) {
      try {
        return generateKeyBetween(null, a);
      } catch {
        /* 後ろも壊れている。下へ */
      }
    }
    return generateKeyBetween(null, null);
  }
}

/**
 * ★ **キーの順に並べ直す。壊れていたら振り直す。**
 *
 * 編集画面は配列の順をそのまま描き、共有ページとサーバーは
 * `fractional_index` の昇順で引く。**この2つがずれる**と、
 * 作った人には正しく見えているのに**共有したものだけ段がバラバラ**になる。
 * 手元（IndexedDB）には配列の順しか残らないので、気付くのが遅れる。
 *
 * → 読んだ時点でキーの順に揃える。キーが壊れている（空、重複）ときは
 * **渡された順を正として振り直す**。編集画面が読むのはローカルで、
 * そこの配列順は本人が見ていた順そのものなので、これが一番確かな手掛かりになる。
 *
 * `repaired` が立ったら呼び出し側がサーバーへ書き戻すこと。
 */
export function orderByIndex<T extends Ordered>(rows: T[]): { rows: T[]; repaired: boolean } {
  if (rows.length === 0) return { rows, repaired: false };

  const keys = rows.map((r) => key(r));
  const broken =
    keys.some((k) => k === null) || new Set(keys).size !== keys.length;

  if (!broken) {
    // 重複が無いので同値の比較は起きない
    const sorted = [...rows].sort((x, y) => (key(x)! < key(y)! ? -1 : 1));
    return { rows: sorted, repaired: false };
  }

  const fresh = generateNKeysBetween(null, null, rows.length);
  return {
    rows: rows.map((row, i) => ({ ...row, fractionalIndex: fresh[i] })),
    repaired: true,
  };
}

/**
 * ★ **最初の段に付けるキー。** 空のまま置かないこと。
 *
 * キーの無い段を `ensureStage` に渡すと `a0` が入る。**キーが無いのは
 * 1段目だけ**なので、新しい段を足すたびに `keyBetween(キーの無い段, undefined)`
 * がまた `a0` を返す——**`a0` が段の数だけ並ぶ。**
 * 実際に9段のうち5段が `a0` になっていた。
 */
export function seedKey(): string {
  return generateKeyBetween(null, null);
}

/**
 * ★ **並べ替えた結果が、キーの順どおりに読めるか確かめる。**
 *
 * `keyBetween` は前後の2つしか見ない。前後が壊れている（同じキーが並ぶ、
 * 空）ときは逃げ道に落ち、**返ってきたキーが別の行とぶつかることがある。**
 * 一度ぶつかると、その隙間に挟む計算が以後ずっと例外になり、
 * **逃げ道が逃げ道を呼んで壊れ方が広がる。**
 *
 * → 並べ替えるたびに、**並べたい順とキーの順が一致しているか**を見る。
 * していなければ全部振り直す。段や本は多くても数十なので、
 * 直すのが遅れて崩れるより、その場で作り直す方が安い。
 */
export function sealOrder<T extends Ordered>(rows: T[]): { rows: T[]; renumbered: boolean } {
  const keys = rows.map((r) => key(r));
  const sound =
    keys.every((k) => k !== null) &&
    new Set(keys).size === keys.length &&
    keys.every((k, i) => i === 0 || keys[i - 1]! < k!);

  if (sound) return { rows, renumbered: false };

  const fresh = generateNKeysBetween(null, null, rows.length);
  return { rows: rows.map((row, i) => ({ ...row, fractionalIndex: fresh[i] })), renumbered: true };
}
