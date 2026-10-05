/**
 * 値が入っている最初のものを選ぶ。
 *
 * ★ **`??` を使わない理由**（CLAUDE.md 14章）。
 *
 * `??` は null / undefined のときしか代替に切り替わらない。ところが
 * **外から来る値は「無い」を空文字で表すことが多い。**
 *
 *  - Vercel の環境変数 … 名前だけ作られて値が空。空の鍵を送って 401 になった
 *  - 楽天の `affiliateUrl` … アフィリエイトIDが未設定だと `""` が返る
 *
 * どちらも `??` で繋いだせいで空のまま採用された。
 *
 * 見つからなかったときに何を返すかは呼ぶ側で変わるので、
 * **`null` を返す版と空文字を返す版を分けてある。**
 */
export function firstNonEmptyOrNull(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** 同じ。見つからなければ空文字（設定値のように「無い＝空」で扱う側で使う） */
export function firstNonEmpty(...values: Array<string | undefined>): string {
  return firstNonEmptyOrNull(...values) ?? "";
}
