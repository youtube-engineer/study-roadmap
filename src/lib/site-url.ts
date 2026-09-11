/**
 * このデプロイの公開URL。
 *
 * 共有URLの表示と OGP の絶対URLに使う。**本番では固定のドメインを指すこと。**
 * Vercel の `VERCEL_URL` はデプロイごとに変わる使い捨てのURLなので、
 * それを本番で使うと共有されたリンクが次のデプロイで意味を失う。
 *
 * 優先順位:
 *   1. NEXT_PUBLIC_SITE_URL                       … 独自ドメインを当てているとき
 *   2. 本番なら NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL … 固定の本番ドメイン
 *   3. それ以外は NEXT_PUBLIC_VERCEL_URL          … プレビュー。毎回変わってよい
 *   4. localhost                                  … 手元
 *
 * NEXT_PUBLIC_ の変数はビルド時に埋め込まれるので、process.env.X の形で
 * そのまま書く必要がある（動的なキーだと置換されない）。
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const productionDomain = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && productionDomain) {
    return `https://${productionDomain}`;
  }

  const deployment = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
