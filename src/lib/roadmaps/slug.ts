/**
 * 共有URL用の識別子。
 *
 * RLSで守れるのは is_public までで、「slugで引いたか」はDBからは分からない。
 * 推測できない長さにしておくことが実質的な保護になる（設計の意図は CLAUDE.md 6章）。
 */
export function newShareSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
